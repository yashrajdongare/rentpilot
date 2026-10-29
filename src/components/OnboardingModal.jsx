import React, { useState } from 'react';
import { Building2, Receipt, ShieldCheck, ArrowRight, Check } from 'lucide-react';

const slides = [
  {
    icon: Building2,
    color: 'bg-blue-500',
    title: 'प्रॉपर्टी आणि भाडेकरू व्यवस्थापन',
    description: 'तुमचे सर्व फ्लॅट्स, खोल्या, PG किंवा दुकानांची माहिती आणि भाडेकरूंचा संपूर्ण रेकॉर्ड एकाच ठिकाणी ठेवा.',
  },
  {
    icon: Receipt,
    color: 'bg-emerald-500',
    title: 'ऑटोमॅटिक भाड्याच्या पावत्या (PDF)',
    description: 'दरमहा आपोआप रेंट रिसीप्ट तयार करा आणि एका क्लिकवर भाडेकरूंना व्हॉट्सअ‍ॅपवर पाठवा किंवा PDF डाऊनलोड करा.',
  },
  {
    icon: ShieldCheck,
    color: 'bg-indigo-500',
    title: '१००% सुरक्षित आणि प्रायव्हेट',
    description: 'तुमचा सर्व डेटा संपूर्णपणे सुरक्षित राहील. कोणाचे भाडे आले आणि कोणाचे बाकी आहे हे सहज ट्रॅक करा.',
  },
];

export default function OnboardingModal({ isOpen, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    onClose();
  };

  const SlideIcon = slides[currentSlide].icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 flex flex-col justify-between min-h-[460px] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header with Skip Button */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Step {currentSlide + 1} of {slides.length}
          </span>
          {currentSlide < slides.length - 1 && (
            <button
              onClick={handleFinish}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition"
            >
              Skip
            </button>
          )}
        </div>

        {/* Center Content (Icon, Title, Description) */}
        <div className="flex flex-col items-center text-center my-6">
          <div className={`w-20 h-20 ${slides[currentSlide].color} text-white rounded-3xl flex items-center justify-center shadow-lg mb-6 transition-all duration-300 transform hover:scale-105`}>
            <SlideIcon className="w-10 h-10" />
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            {slides[currentSlide].title}
          </h2>
          
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
            {slides[currentSlide].description}
          </p>
        </div>

        {/* Bottom Section: Dots Indicator & Action Button */}
        <div>
          {/* Step Indicator Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === index ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Next / Get Started Button */}
          <button
            onClick={handleNext}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-100 transition"
          >
            {currentSlide === slides.length - 1 ? (
              <>
                <span>सुरुवात करा (Get Started)</span>
                <Check className="w-5 h-5" />
              </>
            ) : (
              <>
                <span>पुढे जा (Next)</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}