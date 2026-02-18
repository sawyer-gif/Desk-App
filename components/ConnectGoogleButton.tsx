import React from "react";

const ConnectGoogleButton: React.FC = () => {
  return (
    <button
      onClick={() => {
        window.location.href = "/api/google/auth/start";
      }}
      className="px-3 py-1.5 text-[12px] font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
    >
      Connect Google
    </button>
  );
};

export default ConnectGoogleButton;
