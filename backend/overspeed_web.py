from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
import cv2
import numpy as np
import math
import time
import uuid
import datetime
from ultralytics import YOLO
import torch
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
VIOLATORS_FOLDER = 'violaters'  # Keep the original spelling for compatibility
TEST_FOLDER = 'test'  # Keep the original spelling for compatibility
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}
MAX_CONTENT_LENGTH = 200 * 1024 * 1024  # 200MB max upload size

# Create necessary folders if they don't exist
for folder in [UPLOAD_FOLDER, RESULTS_FOLDER, VIOLATORS_FOLDER,TEST_FOLDER]:
    os.makedirs(folder, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Load YOLO model
model = None
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def load_model():
    global model
    model = YOLO("yolov8n.pt")
    print(f"Model loaded on device: {device}")

# Vehicle classes from YOLO (only the ones we're interested in)
VEHICLE_CLASSES = [1, 2, 3]  # bicycle, car, motorbike

# Settings (default values, can be overridden by requests)
DEFAULT_TRACKING_SENS = 30
DEFAULT_SPEED_LIMIT = 60
DEFAULT_CALC_DISTANCE = 18  # meters between areas

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/process-video', methods=['POST'])
def process_video():
    # Check if model is loaded
    global model
    if model is None:
        load_model()
    
    # Check if the post request has the file part
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400
    
    video_file = request.files['video']
    if video_file.filename == '':
        return jsonify({'error': 'No video file selected'}), 400
    
    if not allowed_file(video_file.filename):
        return jsonify({'error': f'File type not allowed. Allowed types: {ALLOWED_EXTENSIONS}'}), 400
    
    # Get parameters from the request
    tracking_sens = int(request.form.get('tracking_sens', DEFAULT_TRACKING_SENS))
    speed_limit = float(request.form.get('speed_limit', DEFAULT_SPEED_LIMIT))
    calc_distance = float(request.form.get('calc_distance', DEFAULT_CALC_DISTANCE))
    
    # Get areas from the request or use default
    try:
        area1 = json.loads(request.form.get('area1', '[]'))
        area2 = json.loads(request.form.get('area2', '[]'))
        
        # Validate areas
        if not area1 or not area2:
            return jsonify({'error': 'Invalid detection areas provided'}), 400
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON format for areas'}), 400
    
    # Save the uploaded file
    session_id = str(uuid.uuid4())
    filename = secure_filename(video_file.filename)
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}_{filename}")
    video_file.save(video_path)
    
    # Process the video
    try:
        results = process_overspeed_detection(
            video_path, 
            area1, 
            area2, 
            tracking_sens, 
            speed_limit, 
            calc_distance,
            session_id
        )
        
        return jsonify(results), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        # Clean up the uploaded video
        if os.path.exists(video_path):
            os.remove(video_path)

def process_overspeed_detection(video_path, area1, area2, tracking_sens, speed_limit, calc_distance, session_id):
    """
    Process the video for overspeed detection
    """
    # video_path = "test20.mp4"
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("Could not open video file")
    
    # Initialize variables
    count = 0
    center_points_prev_frame = []
    tracking_objects = {}
    track_id = 0
    detectSpeed = {}
    vehicles_entering = {}
    vehicles_captured = {}
    speeding_vehicles = {}
    # area1=[(92, 646), (1057, 652), (658, 249), (334, 254)]
    # area2=[(334, 254), (296, 315), (690, 290), (658, 244)]

 
    # Results to return
    results = {
        'session_id': session_id,
        'speeding_vehicles': [],
        'total_vehicles_detected': 0,
        'processing_time': 0
    }
    
    start_time = time.time()
    
    while True:
        center_points_cur_frame = []
        count += 1
        success, img = cap.read()
        
        if not success:
            break
            
        img = cv2.resize(img, (1280, 720))
        clean_frame = img.copy()
        initial_frame = img.copy()
        
        # Run detection
        detection_results = model(img, stream=True)
        
        for r in detection_results:
            boxes = r.boxes
            for box in boxes:
                # Bounding Box
                x1, y1, x2, y2 = box.xyxy[0]
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                w, h = x2 - x1, y2 - y1
                cx = int((x1 + x1 + w) / 2)
                cy = int((y1 + y1 + h) / 2)
                cls = int(box.cls[0])
                
                if cls in VEHICLE_CLASSES:
                    center_points_cur_frame.append((cx, cy))
                    
                    # Test if point is in first detection area
                    result = cv2.pointPolygonTest(
                        np.array(area1, np.int32), (int(cx), int(cy)), False)
                    if result > 0:
                        # Draw bounding box for vehicles in area1
                        cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 255), 3)
        
        # Processing logic based on frame count
        if count <= 2:
            for pt in center_points_cur_frame:
                for pt2 in center_points_prev_frame:
                    distance = math.hypot(pt2[0] - pt[0], pt2[1] - pt[1])
                    if distance < tracking_sens:
                        tracking_objects[track_id] = pt
                        track_id += 1
        else:
            tracking_objects_copy = tracking_objects.copy()
            center_points_cur_frame_copy = center_points_cur_frame.copy()
            
            # Update existing objects
            for object_id, pt2 in tracking_objects_copy.items():
                object_exists = False
                for pt in center_points_cur_frame_copy:
                    distance = math.hypot(pt2[0] - pt[0], pt2[1] - pt[1])
                    if distance < tracking_sens:
                        tracking_objects[object_id] = pt
                        object_exists = True
                        if pt in center_points_cur_frame:
                            center_points_cur_frame.remove(pt)
                        continue
                
                # Remove IDs lost
                if not object_exists:
                    tracking_objects.pop(object_id)
            
            # Add new IDs found
            for pt in center_points_cur_frame:
                tracking_objects[track_id] = pt
                track_id += 1
            
            # Process each tracked object
            for object_id, pt in tracking_objects.items():
                # Check if object is in area1 (entry area)
                result_down = cv2.pointPolygonTest(
                    np.array(area1, np.int32), (pt[0], pt[1]), True)
                
                if result_down > 0:
                    cv2.circle(img, pt, 5, (0, 0, 255), -1)
                    cv2.putText(img, str(object_id), (pt[0], pt[1]+10), 0, 1, (255, 0, 0), 2)
                    
                    # Register entry time if not already registered
                    if object_id not in vehicles_entering:
                        vehicles_entering[object_id] = time.time()
                        unique_id = uuid.uuid4()
                        
                        # Save initial detection image
                        cv2.circle(initial_frame, pt, 5, (0, 0, 255), -1)
                        cv2.putText(initial_frame, str(object_id), (pt[0], pt[1] + 10), 0, 1, (255, 0, 0), 2)
                        initial_path = os.path.join(VIOLATORS_FOLDER, f'initial_vehicle_{session_id}_{object_id}_{unique_id}.jpg')
                        cv2.imwrite(initial_path, initial_frame)
                
                # Check if vehicle exits through area2 and calculate speed
                if object_id in vehicles_entering:
                    result_top = cv2.pointPolygonTest(
                        np.array(area2, np.int32), (pt[0], pt[1]), False)
                    
                    if result_top > 0:
                        if object_id not in vehicles_captured:
                            elapsed_time = time.time() - vehicles_entering[object_id]
                            vehicles_captured[object_id] = elapsed_time
                            
                            # Calculate speed
                            speed_ms = calc_distance / elapsed_time
                            speed_kmph = speed_ms * 3.6
                            
                            if object_id not in detectSpeed:
                                detectSpeed[object_id] = speed_kmph
                                
                                # Check if vehicle is speeding
                                if speed_kmph > speed_limit:
                                    speeding_vehicles[object_id] = speed_kmph
                                    
                                    # Save speeding vehicle image
                                    cv2.circle(clean_frame, pt, 5, (0, 0, 255), -1)
                                    cv2.putText(clean_frame, f"{int(speed_kmph)} KMPH", (pt[0], pt[1] + 10), 0, 1, (0, 0, 255), 2)
                                    cv2.putText(clean_frame, str(object_id), (pt[0], pt[1] + 40), 0, 1, (255, 0, 0), 2)
                                    # cv2.polylines(img, [area1], isClosed=True, color=(255, 0, 0), thickness=2)
                                    # cv2.polylines(img, [area2], isClosed=True, color=(255, 0, 0), thickness=2)
                                    cv2.polylines(img, [np.array(area2, np.int32)], True, (255, 0, 0), thickness=2)
                                    cv2.polylines(img, [np.array(area1, np.int32)], True, (255, 0, 0), thickness=2)



                                    snapshot_path = os.path.join(VIOLATORS_FOLDER, f'vehicle_{session_id}_{object_id}_speed_{int(speed_kmph)}.jpg')
                                    fullLoc = os.path.abspath(snapshot_path)
                                    shot_path = os.path.join(TEST_FOLDER, f'vehisdsdfsdfsd_{session_id}_{object_id}_speed_{int(speed_kmph)}.jpg')
                                    cv2.imwrite(snapshot_path, clean_frame)
                                    cv2.imwrite(shot_path, img)
                                    
                                    # Add to results
                                    results['speeding_vehicles'].append({
                                        'vehicle_id': object_id,
                                        'speed': int(speed_kmph),
                                        'image_path': fullLoc,
                                        'timestamp': datetime.datetime.now().isoformat()
                                    })
                        
                                    # cv2.imshow("img",img) 
                        # Display speed on tracking image
                        if object_id in detectSpeed:
                            cv2.circle(img, pt, 5, (0, 0, 255), -1)
                            cv2.putText(img, f"{int(detectSpeed[object_id])} KMPH", (pt[0], pt[1] - 7), 0, 1, (0, 0, 255), 2)

        # Save current frame as previous frame
        center_points_prev_frame = center_points_cur_frame.copy()
    # Clean up
    cap.release()
    
    # Calculate total processing time
    processing_time = time.time() - start_time
    
    # Update results
    results['total_vehicles_detected'] = len(vehicles_entering)
    results['processing_time'] = processing_time
    results['speeding_count'] = len(speeding_vehicles)
    
    return results

@app.route('/results/<path:filename>')
def download_file(filename):
    return send_from_directory(RESULTS_FOLDER, filename)

@app.route('/violaters/<path:filename>')
def get_violator_image(filename):
    return send_from_directory(VIOLATORS_FOLDER, filename)

@app.route('/status', methods=['GET'])
def status():
    return jsonify({
        'status': 'operational',
        'device': str(device),
        'gpu_available': torch.cuda.is_available(),
        'model_loaded': model is not None
    })

if __name__ == '__main__':
    # Load model at startup
    load_model()
    
    # Use threaded=True for better performance with multiple requests
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)