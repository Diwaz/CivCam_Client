"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {  Camera, CheckCircle, AlertCircle, Shield, Database,CircleGauge } from "lucide-react";
import { toast } from "sonner";

type RecorderState = "idle" | "recording" | "processing" | "completed" | "error";

// Simulate a server API for processing number plate recognition
const mockServerApi = {
  processVideoChunk: async (chunk: Blob): Promise<void> => {
    console.log("chunks",chunk)
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return Promise.resolve();
  },
  
  getProcessingResult: async (): Promise<{ 
    success: boolean; 
    violations?: Array<{
      plate: string;
      speed: number;
      timestamp: string;
      location: string;
    }>;
    message: string;
  }> => {
    // Simulate API response delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // 90% chance of success
    if (Math.random() > 0.1) {
      return {
        success: true,
        violations: [
          {
            plate: "XYZ-1234",
            speed: 75,
            timestamp: new Date().toLocaleTimeString(),
            location: "Main St & 5th Ave"
          },
          {
            plate: "ABC-9876",
            speed: 82,
            timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
            location: "Highway 101, Mile 42"
          },
          {
            plate: "LMN-5678",
            speed: 68,
            timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
            location: "Central Blvd"
          }
        ],
        message: "Analysis complete. Speed violations detected."
      };
    } else {
      return {
        success: false,
        message: "Could not process video feed. Please check connection and try again."
      };
    }
  }
};

const ScreenRecorder: React.FC = () => {
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [resultMessage, setResultMessage] = useState<string>("");
  const [violations, setViolations] = useState<Array<{
    plate: string;
    speed: number;
    timestamp: string;
    location: string;
  }>>([]);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  
  
  // Cleanup function for stopping recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);
  
  const startRecording = async () => {
    try {
      // Reset state
      chunksRef.current = [];
      setRecordingTime(0);
      setProcessingProgress(0);
      setResultMessage("");
      setViolations([]);
      
      // Request screen capture (simulating camera feed for now)
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          displaySurface: "monitor"
        } 
      });
     console.log("recording started") 
      streamRef.current = stream;
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up data handling
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          
          // Send chunk to server
          try {
            await mockServerApi.processVideoChunk(event.data);
          } catch (error) {
            console.error("Failed to send chunk to server", error);
          }
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        setRecorderState("processing");
        processRecording();
      };
      
      // Start recording with 1-second intervals
      mediaRecorder.start(1000);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
      
      setRecorderState("recording");
      
      // Auto stop after 10 seconds for demo purposes
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          stopRecording();
        }
      }, 10000);
      
      toast(
        
        "Monitoring started",
        {
        description: "Traffic feed is now being analyzed.",
      });
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast(
        
         "Connection failed",
        {
        // variant: "destructive",
        description: "Could not access video feed. Please try again.",
      });
      setRecorderState("error");
    }
  };
  
  const processRecording = async () => {
    // Simulate processing progress
    const progressInterval = setInterval(() => {
      setProcessingProgress((prev) => {
        const newProgress = prev + 10;
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 300);
    
    try {
      // Get processing results from server
      const result = await mockServerApi.getProcessingResult();
      
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
      // Display results
      setResultMessage(result.message);
      setIsSuccess(result.success);
      if (result.violations) {
        setViolations(result.violations);
      }
      
      setRecorderState("completed");
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Processing error:", error);
      setResultMessage("An error occurred during analysis. Please try again.");
      setIsSuccess(false);
      setRecorderState("error");
    }
  };
  
  const reset = () => {
    setRecorderState("idle");
    setRecordingTime(0);
    setProcessingProgress(0);
    setResultMessage("");
    setViolations([]);
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const reportViolations = () => {
    toast("Event Reported !",{
      
      description: "All speed violations have been reported to the network.",
    });
  };
  
  return (
    <Card className="w-full max-w-md bg-gradient-to-br from-[#221F26] to-[#403E43]/80 border border-[#7E69AB]/20">
      <CardContent className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Traffic Monitoring
          </h2>
          <p className="text-muted-foreground">
            Analyze traffic feed for speed violations
          </p>
        </div>
        
        {recorderState === "idle" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="h-40 w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center">
              <Camera className="h-16 w-16 text-muted-foreground" />
            </div>
            <Button 
              className="w-full bg-gradient-primary hover:shadow-md transition-all duration-300" 
              onClick={startRecording}
            >
              <Shield className="mr-2" />
              Start Monitoring
            </Button>
          </div>
        )}
        
        {recorderState === "recording" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="h-40 w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-secondary/10 animate-pulse-opacity"></div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-secondary">
                  {formatTime(recordingTime)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">Analyzing traffic feed</div>
              </div>
            </div>
            <Button 
              variant="destructive"
              className="w-full"
              onClick={stopRecording}
            >
              Stop Monitoring
            </Button>
          </div>
        )}
        
        {recorderState === "processing" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="h-40 w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center flex-col p-6">
              <div className="w-12 h-12 rounded-full border-4 border-t-primary border-primary/30 animate-spin-slow mb-4"></div>
              <div className="text-sm text-muted-foreground mb-2">Processing video data...</div>
              <Progress value={processingProgress} className="w-full" />
            </div>
            <Button disabled className="w-full">
              <Database className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </Button>
          </div>
        )}
        
        {recorderState === "completed" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="h-auto max-h-60 w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex flex-col p-4 overflow-y-auto">
              <div className={`text-center mb-3 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                {isSuccess ? (
                  <CheckCircle className="h-6 w-6 mb-2 mx-auto" />
                ) : (
                  <AlertCircle className="h-6 w-6 mb-2 mx-auto" />
                )}
                <p>{resultMessage}</p>
              </div>
              
              {violations.length > 0 && (
                <div className="space-y-3 mt-3">
                  <h3 className="text-sm font-semibold text-white/80">Speed Violations:</h3>
                  {violations.map((violation, index) => (
                    <div key={index} className="bg-white/5 p-3 rounded-md text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold text-secondary">{violation.plate}</span>
                        <span className="text-red-400 flex items-center">
                          <CircleGauge className="h-4 w-4 mr-1" /> {violation.speed} mph
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{violation.location}</span>
                        <span>{violation.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={reset}
              >
                New Scan
              </Button>
              <Button 
                className="flex-1 bg-gradient-primary hover:shadow-md transition-all duration-300"
                onClick={reportViolations}
              >
                Report Violations
              </Button>
            </div>
          </div>
        )}
        
        {recorderState === "error" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="h-40 w-full rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center flex-col text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mb-2" />
              <p className="text-red-400">
                {resultMessage || "Connection error. Network node may be offline."}
              </p>
            </div>
            <Button 
              className="w-full"
              onClick={reset}
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScreenRecorder;
