import ScreenRecorder from "@/components/ScreenRecorder";


export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#1A1F2C]/95 to-[#8B5CF6]/10 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            ANPR System
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Decentralized Automatic Number Plate Recognition
          </p>
        </div>
        
        <div className="flex justify-center">
          <ScreenRecorder />
        </div>
        
        <div className="mt-10 text-center text-sm text-muted-foreground">
          <p>Secure, decentralized traffic monitoring system powered by blockchain technology</p>
          <p className="mt-1">All data is encrypted and processed with zero-knowledge proofs</p>
        </div>
      </div>
    </div>
  );
}
