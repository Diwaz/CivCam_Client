"use client";
import React, { useRef, useState, useEffect } from 'react';
import {
  Card,
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Camera,
  CheckCircle,
//   AlertCircle,
  Shield,
  Upload,
  CircleGauge,
//   Pencil,
  Layers,
  Settings,
  Play,
  Trash2,
//   AreaChart
} from "lucide-react";
import { toast } from "sonner";

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
//   const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingAreaRef = useRef<HTMLCanvasElement>(null);
 const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // States for UI visibility
    const [videoPreviewVisible, setVideoPreviewVisible] = useState<boolean>(false);
  const [canvasContainerVisible, setCanvasContainerVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressVisible, setProgressVisible] = useState<boolean>(false);
  const [resultsVisible, setResultsVisible] = useState<boolean>(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);
  const [frameWidth, setFrameWidth] = useState<number>(800);
  const [frameHeight, setFrameHeight] = useState<number>(450);



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

  
 // Effect to adjust canvas size and position when image loads
  useEffect(() => {
    if (capturedFrameUrl && imageRef.current && drawingAreaRef.current) {
      const updateCanvasSize = () => {
        if (imageRef.current && drawingAreaRef.current && containerRef.current) {
          // Get the image's displayed dimensions
          const rect = imageRef.current.getBoundingClientRect();
          
          // Update canvas size to match image display size
          drawingAreaRef.current.width = rect.width;
          drawingAreaRef.current.height = rect.height;
          
          // Store these dimensions for coordinate calculations
          setFrameWidth(rect.width);
          setFrameHeight(rect.height);
          
          // Clear and redraw areas to adjust to new canvas size
          redrawAreas();
        }
      };

      // Set initial size
      updateCanvasSize();
      
      // Add resize listener to handle window resize
      window.addEventListener('resize', updateCanvasSize);
      
      // Clean up
      return () => {
        window.removeEventListener('resize', updateCanvasSize);
      };
    }
  }, [capturedFrameUrl, area1Points, area2Points]);

  // Update video src only after the DOM is updated
  useEffect(() => {
    if (videoPreviewVisible && videoFile && videoPreviewRef.current) {
      const objectURL = URL.createObjectURL(videoFile);
      videoPreviewRef.current.src = objectURL;

      return () => URL.revokeObjectURL(objectURL); // cleanup
    }
  }, [videoPreviewVisible, videoFile]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file) {
        setVideoFile(file);
        setVideoPreviewVisible(true);
        toast("Video uploaded", {
          description: "Your traffic footage has been loaded successfully.",
        });
      }
    }
  };
  const captureFrame = () => {
    if (!videoPreviewRef.current) {
      toast("Video not found", {
        description: "Please upload a video first.",
      });
      return;
    }
    
    try {
      // Create a temporary canvas to capture the frame
      const tempCanvas = document.createElement('canvas');
      const video = videoPreviewRef.current;
        console.log(frameHeight,frameWidth);
      // Make sure the video has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        toast("Video not ready", {
          description: "Please wait for the video to load completely.",
        });
        return;
      }
        // Set canvas dimensions to match video
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      
      // Draw the current frame to the canvas
      const context = tempCanvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Convert canvas to data URL
        const frameUrl = tempCanvas.toDataURL('image/jpeg');
        setCapturedFrameUrl(frameUrl);
        
        // Show canvas container
        setCanvasContainerVisible(true);
        
        // Reset drawing areas
        setArea1Points([]);
        setArea2Points([]);
        setCurrentArea(null);
        
        toast("Frame captured", {
          description: "Now you can define detection areas.",
        });
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast("Error capturing frame", {
        description: "There was an error capturing the frame. Please try again.",
      });
    }
  };
  // Get accurate mouse coordinates relative to the canvas
  const getMousePos = (canvas: HTMLCanvasElement, event: React.MouseEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };
  
  const startDrawing = () => {
    if (!currentArea) return;
    setIsDrawing(true);
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentArea || !drawingAreaRef.current) return;
    
    const canvas = drawingAreaRef.current;
    const pos = getMousePos(canvas, e);
    
    // Clear and redraw to show drawing preview
    redrawAreas();
    
    // Draw line from the last point to current mouse position
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      const points = currentArea === 'area1' ? area1Points : area2Points;
      
      if (points.length > 0) {
        ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = currentArea === 'area1' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Draw the temporary point
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = currentArea === 'area1' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(59, 130, 246, 0.8)';
      ctx.fill();
    }
  };



  const endDrawing = () => {
    setIsDrawing(false);
  };
  
  const addPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentArea || !drawingAreaRef.current) return;
    
    const canvas = drawingAreaRef.current;
    const pos = getMousePos(canvas, e);
    
    if (currentArea === 'area1') {
      setArea1Points([...area1Points, pos]);
    } else {
      setArea2Points([...area2Points, pos]);
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
    toast("Areas reset", {
      description: "All detection areas have been cleared.",
    });
  };
  
   // Draw both areas
  const redrawAreas = () => {
    if (!drawingAreaRef.current) return;
    
    const canvas = drawingAreaRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw area 1 (green)
      if (area1Points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(area1Points[0].x, area1Points[0].y);
        
        for (let i = 1; i < area1Points.length; i++) {
          ctx.lineTo(area1Points[i].x, area1Points[i].y);
        }
        
        // Close the path if there are at least 3 points
        if (area1Points.length >= 3) {
          ctx.lineTo(area1Points[0].x, area1Points[0].y);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.fill();
        }
        
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw points
        area1Points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
          ctx.fill();
        });
      }
           // Draw area 2 (blue)
      if (area2Points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(area2Points[0].x, area2Points[0].y);
        
        for (let i = 1; i < area2Points.length; i++) {
          ctx.lineTo(area2Points[i].x, area2Points[i].y);
        }
        
        // Close the path if there are at least 3 points
        if (area2Points.length >= 3) {
          ctx.lineTo(area2Points[0].x, area2Points[0].y);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
          ctx.fill();
        }
        
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw points
        area2Points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
          ctx.fill();
        });
      }
    }
  };
//   const drawPolygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string) => {
//     if (points.length < 1) return;
    
//     ctx.beginPath();
//     ctx.moveTo(points[0].x, points[0].y);
    
//     for (let i = 1; i < points.length; i++) {
//       ctx.lineTo(points[i].x, points[i].y);
//     }
    
//     // Close the polygon if there are at least 3 points
//     if (points.length >= 3) {
//       ctx.lineTo(points[0].x, points[0].y);
//     }
    
//     ctx.strokeStyle = color;
//     ctx.lineWidth = 2;
//     ctx.stroke();
    
//     // Fill with semi-transparent color
//     ctx.fillStyle = color + '40'; // 25% opacity
//     ctx.fill();
    
//     // Draw points
//     for (let i = 0; i < points.length; i++) {
//       ctx.beginPath();
//       ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
//       ctx.fillStyle = color;
//       ctx.fill();
//     }
//   };
  
  const processVideo = async () => {
    if (!videoFileRef.current?.files?.length) {
      toast("Error", {
        description: "Please select a video file.",
      });
      return;
    }
    
    if (area1Points.length < 3 || area2Points.length < 3) {
      toast("Error", {
        description: "Please draw both detection areas with at least 3 points each.",
      });
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
    
    toast("Processing started", {
      description: "Video is being analyzed for speed violations.",
    });
    
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
        toast("Analysis complete", {
          description: `Detected ${responseData.speeding_count} speed violations.`,
        });
      } else {
        let errorMsg = 'Server error occurred';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (error) {
          // Use default error message
         console.log("error:",error) 
        }
        toast("Processing error", {
          description: errorMsg,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast("Request timeout", {
            description: "The video may be too large or the server is busy.",
          });
        } else {
          toast("Error", {
            description: error.message,
          });
        }
      } else {
        toast("Unknown error", {
          description: "An unexpected problem occurred.",
        });
      }
    } finally {
      setIsLoading(false);
      setProgressVisible(false);
    }
  };
  
  return (
    <div className="container mx-auto max-w-4xl pt-8 px-4">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">Overspeed Detection System</h1>
      
      <Card className="mb-6 w-full bg-gradient-to-br from-[#221F26] to-[#403E43]/80 border border-[#7E69AB]/20">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-2">
              1. Upload Traffic Footage
            </h2>
            <p className="text-muted-foreground text-sm">
              Select a video file containing traffic to analyze
            </p>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="videoFile" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer border-white/10 hover:border-white/20 bg-white/5 backdrop-blur-md">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-secondary" />
                  <p className="mb-2 text-sm text-white/80">
                    <span className="font-bold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MP4, AVI, MOV, MKV (MAX. 100MB)
                  </p>
                </div>
                <input 
                  id="videoFile"
                  ref={videoFileRef}
                  accept="video/*"
                  onChange={handleFileChange}
                  type="file" 
                  className="hidden" 
                />
              </label>
            </div>
          </div>
          
          {videoPreviewVisible && (
            <div className="mb-4">
              <div className="h-auto w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden">
                <video 
                  ref={videoPreviewRef} 
                  className="w-full" 
                  controls
                />
              </div>
              <Button 
                className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-md transition-all duration-300" 
                onClick={captureFrame}
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture Frame
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canvas Container */}
      {canvasContainerVisible && capturedFrameUrl && (
        <Card className="mb-6 w-full bg-gradient-to-br from-[#221F26] to-[#403E43]/80 border border-[#7E69AB]/20">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-2">
                2. Define Detection Areas
              </h2>
              <p className="text-muted-foreground text-sm">
                Create entry zone (green) and exit zone (blue) by clicking to place points
              </p>
            </div>
            
            <div className="relative mb-4" ref={containerRef}>
              {/* Display captured frame as image */}
              <img 
                ref={imageRef}
                src={capturedFrameUrl} 
                alt="Captured Frame"
                className="w-full h-auto rounded-md"
                onLoad={() => {
                  // Adjust canvas dimensions when image loads
                  if (imageRef.current && drawingAreaRef.current) {
                    const rect = imageRef.current.getBoundingClientRect();
                    drawingAreaRef.current.width = rect.width;
                    drawingAreaRef.current.height = rect.height;
                    setFrameWidth(rect.width);
                    setFrameHeight(rect.height);
                  }
                }}
              />
              
              {/* Drawing canvas overlay */}
              <canvas
                ref={drawingAreaRef}
                className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }} // Prevents scrolling on touch devices
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onClick={addPoint}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className={`${currentArea === 'area1' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-white/5 border-white/10'}`}
                onClick={() => {
                  resetDrawing();
                  setCurrentArea('area1');
                }}
              >
                <Layers className="mr-2 h-4 w-4 text-emerald-500" />
                Entry Zone
              </Button>
              <Button
                variant="outline"
                className={`${currentArea === 'area2' ? 'bg-blue-500/20 border-blue-500' : 'bg-white/5 border-white/10'}`}
                onClick={() => {
                  resetDrawing();
                  setCurrentArea('area2');
                }}
              >
                <Layers className="mr-2 h-4 w-4 text-blue-500" />
                Exit Zone
              </Button>
              <Button
                variant="outline"
                className="bg-red-500/10 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50"
                onClick={resetAreas}
              >
                <Trash2 className="mr-2 h-4 w-4 text-red-400" />
                Reset Areas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 w-full bg-gradient-to-br from-[#221F26] to-[#403E43]/80 border border-[#7E69AB]/20">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-2">
              3. Detection Settings
            </h2>
            <p className="text-muted-foreground text-sm">
              Configure sensitivity and thresholds for speed detection
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <label htmlFor="trackingSens" className="text-sm text-white/80">
                  Tracking Sensitivity
                </label>
                <span className="text-sm text-secondary">{trackingSensitivity}%</span>
              </div>
              <input
                type="range"
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-secondary"
                id="trackingSens"
                min={10}
                max={100}
                value={trackingSensitivity}
                onChange={(e) => setTrackingSensitivity(parseInt(e.target.value))}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low Detection</span>
                <span>High Detection</span>
              </div>
            </div>
            
            <div>
              <label htmlFor="speedLimit" className="block text-sm text-white/80 mb-1">
                Speed Limit (km/h)
              </label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full p-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  id="speedLimit"
                  value={speedLimit}
                  onChange={(e) => setSpeedLimit(parseInt(e.target.value))}
                  min={1}
                />
                <CircleGauge className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            
            <div>
              <label htmlFor="calcDistance" className="block text-sm text-white/80 mb-1">
                Distance Between Areas (meters)
              </label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full p-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  id="calcDistance"
                  value={calcDistance}
                  onChange={(e) => setCalcDistance(parseFloat(e.target.value))}
                  min={1}
                  step={0.1}
                />
                <Layers className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 w-full bg-gradient-to-br from-[#221F26] to-[#403E43]/80 border border-[#7E69AB]/20">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-2">
              4. Process Video
            </h2>
            <p className="text-muted-foreground text-sm">
              Start analysis to detect speeding violations
            </p>
          </div>
          
          {!isLoading && !progressVisible && (
            <Button 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-md transition-all duration-300" 
              onClick={processVideo}
              disabled={!canvasContainerVisible || area1Points.length < 3 || area2Points.length < 3}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Analysis
            </Button>
          )}
          
          {progressVisible && (
            <div className="space-y-4">
              <div className="h-40 w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center flex-col p-6">
                <div className="w-12 h-12 rounded-full border-4 border-t-secondary border-secondary/30 animate-spin-slow mb-4"></div>
                <div className="text-sm text-muted-foreground mb-2">Processing video data...</div>
                <Progress value={uploadProgress} className="w-full h-2" />
              </div>
              <Button disabled className="w-full">
                <Settings className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {resultsVisible && results && (
        <Card className="mb-6 w-full bg-gradient-to-br from-[#221F26] to-[#403E43]/80 border border-[#7E69AB]/20">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-2">
                Detection Results
              </h2>
              <div className="flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                <p className="text-green-400">Analysis complete</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-md bg-gradient-to-br from-emerald-900/30 to-emerald-600/10 border border-emerald-500/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Vehicles</p>
                <p className="text-3xl font-bold text-emerald-400">{results.total_vehicles_detected}</p>
              </div>
              <div className="rounded-md bg-gradient-to-br from-red-900/30 to-red-600/10 border border-red-500/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Speeding</p>
                <p className="text-3xl font-bold text-red-400">{results.speeding_count}</p>
              </div>
              <div className="rounded-md bg-gradient-to-br from-blue-900/30 to-blue-600/10 border border-blue-500/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Processing Time</p>
                <p className="text-3xl font-bold text-blue-400">{results.processing_time}s</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-secondary mb-4">Speeding Violations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {results.speeding_vehicles?.map((vehicle) => (
                <div key={vehicle.vehicle_id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-md p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm">
                      <span className="text-white/80">Vehicle #{vehicle.vehicle_id}</span>
                      {vehicle.plate && <span className="block text-muted-foreground">{vehicle.plate}</span>}
                    </div>
                    <div className="bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full text-red-400 text-sm flex items-center">
                      <CircleGauge className="h-3.5 w-3.5 mr-1" />
                      {vehicle.speed} km/h
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Detected at: {vehicle.timestamp}
                  </div>
                  {vehicle.image_path && (
                    <div className="mt-3 rounded-md overflow-hidden">
                      <img 
                        src={vehicle.image_path} 
                        alt={`Vehicle #${vehicle.vehicle_id}`}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <Button 
              className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-md transition-all duration-300"
              onClick={() => {
                toast("Violations Reported", {
                  description: "All speed violations have been reported to the network.",
                });
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              Report All Violations
            </Button>
          </CardContent>
        </Card>
      )}
    </div>

    );
};

export default OverspeedDetection;