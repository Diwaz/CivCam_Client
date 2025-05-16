"use client";
import React, { useRef, useState, useEffect } from 'react';
import Head from 'next/head';

interface Point {
  x: number;
  y: number;
}

interface ProcessingResults {
  total_vehicles_detected: number;
  speeding_count: number;
  processing_time: number;
  speeding_vehicles: Array<{
    vehicle_id: number;
    speed: number;
    timestamp: string;
    plate?: string;
    image_path?: string;
  }>;
}

const OverspeedDetection: React.FC = () => {
  // Refs
  const videoFileRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingAreaRef = useRef<HTMLCanvasElement>(null);
  
  // States for UI visibility
  const [videoPreviewVisible, setVideoPreviewVisible] = useState<boolean>(false);
  const [canvasContainerVisible, setCanvasContainerVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressVisible, setProgressVisible] = useState<boolean>(false);
  const [resultsVisible, setResultsVisible] = useState<boolean>(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);


  // States for drawing
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentArea, setCurrentArea] = useState<'area1' | 'area2' | null>(null);
  const [area1Points, setArea1Points] = useState<Point[]>([]);
  const [area2Points, setArea2Points] = useState<Point[]>([]);
  
  // States for settings
  const [trackingSensitivity, setTrackingSensitivity] = useState<number>(30);
  const [speedLimit, setSpeedLimit] = useState<number>(60);
  const [calcDistance, setCalcDistance] = useState<number>(18);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // States for results
  const [results, setResults] = useState<ProcessingResults | null>(null);
  
  // Effect to redraw areas when points change
  useEffect(() => {
    if (drawingAreaRef.current) {
      redrawAreas();
    }
  }, [area1Points, area2Points]);

  // Update video src only after the DOM is updated
  useEffect(() => {
    if (videoPreviewVisible && videoFile && videoPreviewRef.current) {
      const objectURL = URL.createObjectURL(videoFile);
      videoPreviewRef.current.src = objectURL;
      console.log("src", objectURL);

      return () => URL.revokeObjectURL(objectURL); // cleanup
    }
  }, [videoPreviewVisible, videoFile]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file) {
        // videoPreviewRef.current.src = URL.createObjectURL(file);
        setVideoFile(file);
        setVideoPreviewVisible(true)
        // console.log("src",videoPreviewRef.current.src)
      }
    }
  };
  
  const captureFrame = () => {
    if (videoPreviewRef.current && videoPreviewRef.current.readyState >= 2) {
        setCanvasContainerVisible(true);
      const videoCanvas = videoCanvasRef.current;
      console.log("here",videoCanvas)
      if (videoCanvas) {
        const context = videoCanvas.getContext('2d');
        if (context) {
          context.drawImage(
            videoPreviewRef.current, 
            0, 
            0, 
            videoCanvas.width, 
            videoCanvas.height
          );
        }
      }
    }
  };
  
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentArea) return;
    setIsDrawing(true);
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentArea || !drawingAreaRef.current) return;
    
    const rect = drawingAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    redrawAreas();
    
    // Draw line from last point to current position
    const ctx = drawingAreaRef.current.getContext('2d');
    if (!ctx) return;
    
    const points = currentArea === 'area1' ? area1Points : area2Points;
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = currentArea === 'area1' ? 'green' : 'blue';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  
  const endDrawing = () => {
    setIsDrawing(false);
  };
  
  const addPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentArea || !drawingAreaRef.current) return;
    
    const rect = drawingAreaRef.current.getBoundingClientRect();
    
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    
    if (currentArea === 'area1') {
      setArea1Points([...area1Points, { x, y }]);
    } else {
      setArea2Points([...area2Points, { x, y }]);
    }
  };
  
  const resetDrawing = () => {
    setIsDrawing(false);
    redrawAreas();
  };
  
  const resetAreas = () => {
    setArea1Points([]);
    setArea2Points([]);
    setCurrentArea(null);
    redrawAreas();
  };
  
  const redrawAreas = () => {
    const canvas = drawingAreaRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw area1
    drawPolygon(ctx, area1Points, 'green');
    
    // Draw area2
    drawPolygon(ctx, area2Points, 'blue');
  };
  
  const drawPolygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string) => {
    if (points.length < 1) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    // Close the polygon if there are at least 3 points
    if (points.length >= 3) {
      ctx.lineTo(points[0].x, points[0].y);
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Fill with semi-transparent color
    ctx.fillStyle = color + '40'; // 25% opacity
    ctx.fill();
    
    // Draw points
    for (let i = 0; i < points.length; i++) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };
  
  const processVideo = async () => {
    if (!videoFileRef.current?.files?.length) {
      alert('Please select a video file');
      return;
    }
    
    if (area1Points.length < 3 || area2Points.length < 3) {
      alert('Please draw both detection areas with at least 3 points each');
      return;
    }
    
    // Convert canvas coordinates to array format for backend
    const area1Array = area1Points.map(p => [Math.round(p.x*1.6), Math.round(p.y*1.6)]);
    const area2Array = area2Points.map(p => [Math.round(p.x*1.6), Math.round(p.y*1.6)]);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('video', videoFileRef.current.files[0]);
    formData.append('area1', JSON.stringify(area1Array));
    formData.append('area2', JSON.stringify(area2Array));
    formData.append('tracking_sens', trackingSensitivity.toString());
    formData.append('speed_limit', speedLimit.toString());
    formData.append('calc_distance', calcDistance.toString());
    
    // Show loader and progress
    setIsLoading(true);
    setProgressVisible(true);
    
    try {
      // Using modern fetch API with AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      // We can't directly track progress with fetch, so we set a simulated progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 500);
      
      const response = await fetch('http://localhost:5000/process-video', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.ok) {
        const responseData = await response.json();
        setResults(responseData);
        setResultsVisible(true);
      } else {
        let errorMsg = 'Server error occurred';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          // Use default error message
        }
        alert('Error: ' + errorMsg);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert('Request timed out. The video may be too large or the server is busy.');
        } else {
          alert('Error: ' + error.message);
        }
      } else {
        alert('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
      setProgressVisible(false);
    }
  };
  
  return (
    <div className="container mx-auto max-w-4xl mt-8 px-4">
      <Head>
        <title>Overspeed Detection System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <h1 className="text-3xl font-bold mb-6">Overspeed Detection System</h1>
      
      <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
        <header className="bg-gray-100 px-4 py-2 border-b">
          <h2 className="font-semibold">1. Upload Video</h2>
        </header>
        <div className="p-4">
          <div className="mb-4">
            <label htmlFor="videoFile" className="block text-sm font-medium mb-1">
              Select Video File
            </label>
            <input
              className="block w-full text-sm border border-gray-300 rounded cursor-pointer focus:outline-none"
              type="file"
              id="videoFile"
              ref={videoFileRef}
              accept="video/*"
              onChange={handleFileChange}
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: MP4, AVI, MOV, MKV
            </p>
          </div>
          
          {videoPreviewVisible && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Video Preview</label>
              <video 
                ref={videoPreviewRef} 
                className="w-full" 
                controls
              />
            </div>
          )}
        </div>
      </section>

      <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
        <header className="bg-gray-100 px-4 py-2 border-b">
          <h2 className="font-semibold">2. Define Detection Areas</h2>
        </header>
        <div className="p-4">
          <p className="mb-3">
            Capture a frame and define two polygon areas: entry area (green) and exit area (blue).
          </p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={captureFrame}
            disabled={!videoPreviewVisible}
          >
            Capture Frame
          </button>
          
          {canvasContainerVisible && (
            <div className="mt-4 relative">
              <canvas 
                ref={videoCanvasRef} 
                width={800} 
                height={450}
                className="border border-gray-300"
                style={{ backgroundImage: `url('/api/placeholder/800/450')`, backgroundSize: 'cover' }}
              />
              <canvas
                ref={drawingAreaRef}
                width={800}
                height={450}
                className="absolute top-0 left-0"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onClick={addPoint}
              />
              
              <div className="mt-2 flex gap-2">
                <button
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={() => {
                    resetDrawing();
                    setCurrentArea('area1');
                  }}
                  disabled={currentArea === 'area1'}
                >
                  Draw Entry Area (Green)
                </button>
                <button
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={() => {
                    resetDrawing();
                    setCurrentArea('area2');
                  }}
                  disabled={currentArea === 'area2'}
                >
                  Draw Exit Area (Blue)
                </button>
                <button
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  onClick={resetAreas}
                >
                  Reset Areas
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
        <header className="bg-gray-100 px-4 py-2 border-b">
          <h2 className="font-semibold">3. Detection Settings</h2>
        </header>
        <div className="p-4">
          <div className="mb-4">
            <label htmlFor="trackingSens" className="block text-sm font-medium mb-1">
              Tracking Sensitivity
            </label>
            <input
              type="range"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              id="trackingSens"
              min={10}
              max={100}
              value={trackingSensitivity}
              onChange={(e) => setTrackingSensitivity(parseInt(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Low (10)</span>
              <span>{trackingSensitivity}</span>
              <span>High (100)</span>
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="speedLimit" className="block text-sm font-medium mb-1">
              Speed Limit (km/h)
            </label>
            <input
              type="number"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="speedLimit"
              value={speedLimit}
              onChange={(e) => setSpeedLimit(parseInt(e.target.value))}
              min={1}
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="calcDistance" className="block text-sm font-medium mb-1">
              Distance Between Areas (meters)
            </label>
            <input
              type="number"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="calcDistance"
              value={calcDistance}
              onChange={(e) => setCalcDistance(parseFloat(e.target.value))}
              min={1}
              step={0.1}
            />
          </div>
        </div>
      </section>

      <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
        <header className="bg-gray-100 px-4 py-2 border-b">
          <h2 className="font-semibold">4. Process Video</h2>
        </header>
        <div className="p-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={processVideo}
            disabled={!canvasContainerVisible || area1Points.length < 3 || area2Points.length < 3 || isLoading}
          >
            Process Video
          </button>
          
          {progressVisible && (
            <div className="mt-4">
              <p className="block text-sm font-medium mb-1">Processing video...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
            </div>
          )}
        </div>
      </section>

      {resultsVisible && results && (
        <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
          <header className="bg-blue-500 text-white px-4 py-2 border-b">
            <h2 className="font-semibold">Results</h2>
          </header>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-green-500 text-white rounded-md p-4 text-center">
                <h3 className="font-medium">Total Vehicles</h3>
                <p className="text-3xl font-bold">{results.total_vehicles_detected}</p>
              </div>
              <div className="bg-red-500 text-white rounded-md p-4 text-center">
                <h3 className="font-medium">Speeding Vehicles</h3>
                <p className="text-3xl font-bold">{results.speeding_count}</p>
              </div>
              <div className="bg-blue-400 text-white rounded-md p-4 text-center">
                <h3 className="font-medium">Processing Time</h3>
                <p className="text-3xl font-bold">{results.processing_time}s</p>
              </div>
            </div>

            <h3 className="font-semibold mt-6 mb-3">Speeding Vehicles Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.speeding_vehicles?.map((vehicle) => (
                <article key={vehicle.vehicle_id} className="border rounded-md p-3 shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Vehicle #{vehicle.vehicle_id}</span>
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">
                      {vehicle.speed} km/h
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Detected at: {vehicle.timestamp}</p>
                    {vehicle.plate && <p>Plate: {vehicle.plate}</p>}
                  </div>
                  {vehicle.image_path && (
                    <div className="mt-2">
                      <img 
                        src={vehicle.image_path} 
                        alt={`Vehicle #${vehicle.vehicle_id}`}
                        className="w-full h-auto rounded"
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default OverspeedDetection;
