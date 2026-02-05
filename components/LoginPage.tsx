import { SignInButton, SignedIn, SignedOut } from "@clerk/clerk-react";

import React from 'react';

export const LoginPage: React.FC = () => {



  return (
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#08080A]">
      {/* Background Video - Dark Abstract Motion with Purple Accents */}
<video
  autoPlay
  muted
  loop
  playsInline
  className="absolute inset-0 w-full h-full object-cover opacity-70"

>
  <source src="/video/login-bg.mp4" type="video/mp4" />
</video>


      {/* Cinematic Vignette & Deep Purple Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />
      <div className="absolute inset-0 bg-[#120520]/20 mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient(circle_at_center,transparent_0%,black_100%) opacity-60 pointer-events-none" />

      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-[420px] mx-6 flex flex-col items-center">
        
        {/* Primary Branding */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-[64px] font-semibold text-white tracking-tighter leading-none mb-3 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
            Desk
          </h1>
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.4em] translate-x-[0.2em]">
            Sawyer's Command
          </p>
        </div>

        {/* The Card */}
        <div className="w-full bg-white/[0.06] backdrop-blur-[40px] border border-white/10 rounded-[40px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-700">
          
          {/* TODO: Integrate Clerk Auth here */}
       <div className="space-y-4">
 
    <SignInButton mode="modal">
      <button
        className="w-full bg-white text-black py-4 px-8 rounded-full font-bold flex items-center justify-center gap-3 hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
      >
        <img
          src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
          className="w-5 h-5"
          alt="Google"
        />
        <span className="text-[15px] tracking-tight">
          Continue with Google
        </span>
      </button>
    </SignInButton>

</div>

            
            <button
              disabled
              className="w-full bg-transparent text-white/40 py-3 px-8 rounded-full font-semibold flex items-center justify-center gap-2 cursor-not-allowed text-[14px] hover:text-white/60 transition-colors"
            >
              Use a different account
            </button>
          </div>

          <div className="mt-10 flex flex-col items-center">
            <div className="h-px w-8 bg-white/10 mb-6" />
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] text-center max-w-[200px] leading-relaxed">
              MR Walls Team Access Only
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-12 flex justify-center gap-8 text-[11px] font-bold text-white/20 uppercase tracking-widest">
          <a href="#" className="hover:text-white/50 transition-colors">Privacy</a>
          <a href="#" className="hover:text-white/50 transition-colors">Terms</a>
          <a href="#" className="hover:text-white/50 transition-colors">Support</a>
        </div>
      </div>
    </div>
  );
};
