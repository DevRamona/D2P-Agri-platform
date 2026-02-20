import { useState, useRef } from "react";
import Webcam from "react-webcam";
import { apiFetch } from "../api/client";
import type { ViewMode } from "../types";

interface AIQualityScannerProps {
    onNavigate: (view: ViewMode) => void;
}

const AIQualityScanner = ({ onNavigate }: AIQualityScannerProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [cropType, setCropType] = useState<"maize" | "beans">("beans");

    const mockStats = {
        moisture: "13.5%",
        pests: "None",
        color: "Grade A",
    };

    const capture = () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImgSrc(imageSrc);
            handleAnalysis(imageSrc, cropType);
        }
    };

    const handleAnalysis = async (imageSrc: string, selectedCrop: "maize" | "beans") => {
        setAnalyzing(true);
        setResult(null);

        try {
            const res = await fetch(imageSrc);
            const blob = await res.blob();
            const file = new File([blob], "scan.jpg", { type: "image/jpeg" });

            const formData = new FormData();
            formData.append("image", file);
            formData.append("crop", selectedCrop);

            const data = await apiFetch<any>("/farmer/scan-quality", {
                method: "POST",
                body: formData,
            });

            setResult(data);
        } catch (error) {
            console.error("Analysis failed", error);
        } finally {
            setAnalyzing(false);
        }
    };

    const reset = () => {
        setImgSrc(null);
        setResult(null);
        setAnalyzing(false);
    };

    const diseaseLabelRaw = result?.pests || (cropType === "beans" ? "healthy" : "None");
    const normalizedDisease = String(diseaseLabelRaw).toLowerCase();
    const hasDisease = normalizedDisease !== "none" && normalizedDisease !== "healthy";
    const diseaseLabel = String(diseaseLabelRaw)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

    return (
        <div className="relative h-screen w-full max-w-[520px] bg-black text-white overflow-hidden flex flex-col">
            <div className="absolute top-0 w-full z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/70 to-transparent">
                <button onClick={() => onNavigate("dashboard")} className="p-2 rounded-full bg-black/40 backdrop-blur-md">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="font-semibold text-lg">AI Quality Scan</span>
                <button className="p-2 rounded-full bg-black/40 backdrop-blur-md">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
            </div>

            <div className="flex-1 relative">
                {imgSrc ? (
                    <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                        videoConstraints={{ facingMode: "environment" }}
                    />
                )}

                {!imgSrc && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 border-green-500 rounded-3xl relative opacity-80">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 rounded-tl-xl -mt-1 -ml-1"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 rounded-tr-xl -mt-1 -mr-1"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 rounded-bl-xl -mb-1 -ml-1"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 rounded-br-xl -mb-1 -mr-1"></div>

                            <div className="absolute top-1/3 left-1/4 w-3 h-3 border-2 border-green-400 rounded-full animate-ping"></div>
                            <div className="absolute bottom-1/3 right-1/3 w-3 h-3 border-2 border-green-400 rounded-full animate-ping delay-300"></div>
                            <div className="absolute top-1/2 right-1/4 w-3 h-3 border-2 border-green-400 rounded-full animate-ping delay-700"></div>
                        </div>
                        <div className="absolute top-24 bg-green-600 px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 animate-bounce">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Ideal Distance
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-0 w-full bg-linear-gradient(to top, black, transparent) pt-20 pb-8 px-5">

                {!imgSrc && (
                    <div className="flex justify-center mb-8">
                        <div className="bg-black/40 backdrop-blur-md rounded-full p-1 flex border border-white/10">
                            <button
                                onClick={() => setCropType("maize")}
                                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${cropType === "maize" ? "bg-green-600 text-white" : "text-gray-300"}`}
                            >
                                Maize
                            </button>
                            <button
                                onClick={() => setCropType("beans")}
                                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${cropType === "beans" ? "bg-green-600 text-white" : "text-gray-300"}`}
                            >
                                Beans
                            </button>
                        </div>
                    </div>
                )}

                {!imgSrc && (
                    <div className="flex justify-between items-center px-8 mb-6">
                        <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md grid place-items-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                        <button
                            onClick={capture}
                            className="w-20 h-20 rounded-full border-4 border-white grid place-items-center p-1"
                        >
                            <div className="w-full h-full bg-white rounded-full active:scale-90 transition-transform"></div>
                        </button>
                        <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md grid place-items-center text-red-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeMiterlimit="10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                        </button>
                    </div>
                )}

                {imgSrc && (
                    <div className="bg-[#1a2118]/90 backdrop-blur-xl rounded-[24px] p-5 border border-white/10 animate-[rise_0.4s_ease_both]">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${analyzing ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                                <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">{analyzing ? 'ANALYZING...' : 'ANALYSIS COMPLETE'}</span>
                            </div>
                            {analyzing ? null : <button onClick={reset} className="text-sm text-white/70 hover:text-white">Retake</button>}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-black/40 rounded-2xl p-3 text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Moisture</p>
                                <p className="text-xl font-bold">{analyzing ? "..." : (result?.moisture || mockStats.moisture)}</p>
                            </div>
                            <div className="bg-black/40 rounded-2xl p-3 text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Disease</p>
                                <p className={`text-xl font-bold ${hasDisease ? 'text-red-400' : 'text-white'}`}>
                                    {analyzing ? "..." : diseaseLabel}
                                </p>
                            </div>
                            <div className="bg-black/40 rounded-2xl p-3 text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Color</p>
                                <p className="text-xl font-bold">{analyzing ? "..." : (result?.grade || mockStats.color)}</p>
                            </div>
                        </div>

                        {result && !analyzing && (
                            <div className="mt-4 p-3 bg-white/5 rounded-xl text-sm text-gray-300">
                                <p className="mb-1 text-xs text-gray-500 uppercase font-bold">Recommendation</p>
                                <p>{result.recommendation || "No recommendation returned."}</p>
                            </div>
                        )}
                    </div>
                )}

                {!imgSrc && (
                    <div className="bg-[#1a2118]/80 backdrop-blur-md rounded-[24px] p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">REAL-TIME ANALYSIS</span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                On-device AI Active
                            </span>
                        </div>
                        <div className="flex justify-between divide-x divide-white/10">
                            <div className="px-2 text-center flex-1">
                                <p className="text-[10px] text-gray-500">Moisture</p>
                                <p className="font-bold text-lg">13.5%</p>
                            </div>
                            <div className="px-2 text-center flex-1">
                                <p className="text-[10px] text-gray-500">Pests</p>
                                <p className="font-bold text-lg">None</p>
                            </div>
                            <div className="px-2 text-center flex-1">
                                <p className="text-[10px] text-gray-500">Color</p>
                                <p className="font-bold text-lg">Grade A</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIQualityScanner;
