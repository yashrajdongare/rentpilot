import React, { useState } from 'react';
import { Check, Zap, Shield, Crown } from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free Starter',
    price: 0,
    period: 'कायमस्वरूपी मोफत',
    desc: 'लहान घरमालकांसाठी (१-२ खोल्या)',
    features: [
      'कमाल २ प्रॉपर्टीज / फ्लॅट्स',
      'कमाल ५ भाडेकरू',
      'मॅन्युअल पेमेंट रेकॉर्डिंग',
      'बेसिक PDF पावत्या',
    ],
    highlight: false,
    buttonText: 'Current Plan',
  },
  {
    id: 'pro',
    name: 'Landlord Pro',
    price: 199,
    period: 'प्रति महिना',
    desc: 'मध्यम आणि वाढत्या प्रॉपर्टी मॅनेजर्ससाठी',
    features: [
      'अमर्यादित प्रॉपर्टीज आणि युनिट्स',
      'अमर्यादित भाडेकरू व्यवस्थापन',
      'ऑटोमॅटिक WhatsApp रिमाइंडर्स',
      'सर्व ५ प्रकारच्या डिझाईनर PDF पावत्या',
      'एक्सेल (Excel) एक्सपोर्ट आणि बॅकअप',
    ],
    highlight: true,
    buttonText: 'Upgrade to Pro',
  },
  {
    id: 'business',
    name: 'Commercial / PG',
    price: 499,
    period: 'प्रति महिना',
    desc: 'हॉस्टेल, PG आणि कमर्शियल संकुलांसाठी',
    features: [
      'सर्व Pro फीचर्स समाविष्ट',
      'मल्टिपल मॅनेजर / स्टाफ लॉगिन्स',
      'GST आणि टॅक्स इनव्हॉइसिंग',
      'SMS ऑटोमेशन गेटवे',
      '२४/७ प्रायॉरिटी सपोर्ट',
    ],
    highlight: false,
    buttonText: 'Get Business',
  },
];

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

  const handleSubscribe = (planId) => {
    if (planId === 'free') return;
    alert(`Razorpay / Payment Gateway उघडेल (${planId.toUpperCase()} Plan साठी)`);
    // बॅकएंड मित्राकडून Razorpay Checkout API इथे ट्रिगर होईल
  };

  return (
    <div className="p-4 sm:p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          SaaS Plans & Pricing
        </span>
        <h1 className="text-3xl font-black text-slate-800 mt-3 mb-2">
          तुमच्या गरजेनुसार योग्य प्लॅन निवडा
        </h1>
        <p className="text-sm text-slate-500">
          कोणतेही छुपे शुल्क नाही. तुम्हाला पाहिजे तेव्हा प्लॅन अपग्रेड किंवा कॅन्सल करा.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 relative ${
              plan.highlight
                ? 'border-2 border-indigo-600 shadow-xl shadow-indigo-100 scale-105'
                : 'border border-slate-200 shadow-sm hover:shadow-md'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[11px] font-bold py-1 px-3.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Crown className="w-3.5 h-3.5" /> Most Popular
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">{plan.desc}</p>

              <div className="flex items-baseline gap-1 my-4">
                <span className="text-3xl font-black text-slate-900">₹{plan.price}</span>
                <span className="text-xs font-medium text-slate-400">/{plan.period}</span>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleSubscribe(plan.id)}
              className={`w-full mt-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition ${
                plan.highlight
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}