import React, { useState } from 'react';
import { Check, Zap, Shield, Crown } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';

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
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="text-center pt-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          SaaS Plans & Pricing
        </span>
        <h1 className="text-2xl font-extrabold text-ink dark:text-white mt-3 mb-1.5 tracking-tight">
          योग्य प्लॅन निवडा
        </h1>
        <p className="text-xs text-muted dark:text-muted/80 max-w-sm mx-auto">
          कोणतेही छुपे शुल्क नाही. तुम्हाला पाहिजे तेव्हा प्लॅन अपग्रेड किंवा कॅन्सल करा.
        </p>
      </div>

      {/* Pricing Cards Stack / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {plans.map((plan) => (
          <GlassCard
            key={plan.id}
            strong={plan.highlight}
            className={`relative p-5 sm:p-6 transition-all duration-200 ${plan.highlight
              ? 'ring-2 ring-primary dark:ring-primary2 shadow-xl shadow-primary/25 dark:shadow-primary2/35'
              : ''
              }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-primary2 text-white text-[10px] font-extrabold py-0.5 px-3 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3 stroke-[2]" /> Most Popular
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-ink dark:text-white">{plan.name}</h3>
                {plan.id === 'pro' && (
                  <span className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded-full border border-teal/20">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-muted dark:text-muted/80 mt-1 mb-3">{plan.desc}</p>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-2xl font-extrabold text-ink dark:text-white">₹{plan.price}</span>
                <span className="text-xs font-semibold text-muted">/{plan.period}</span>
              </div>

              <div className="space-y-2 pt-3 border-t border-white/60 dark:border-white/10">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs font-semibold text-ink dark:text-white/90">
                    <Check className="w-4 h-4 text-teal shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleSubscribe(plan.id)}
              className={`w-full mt-5 py-3 rounded-btn font-bold text-xs transition-all active:scale-95 cursor-pointer ${plan.highlight
                ? 'bg-gradient-to-r from-primary to-primary2 hover:opacity-95 text-white shadow-lg shadow-primary/30 border border-white/20'
                : 'glass-panel hover:bg-white dark:hover:bg-white/10 text-ink dark:text-white border border-white/80 dark:border-white/12'
                }`}
            >
              {plan.buttonText}
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}