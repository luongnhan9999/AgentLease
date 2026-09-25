import React, { useState } from 'react';
import { Cpu, Server, Wallet, RefreshCw, Settings, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { shortenAddress, formatGen } from '../utils/helpers';
import { switchToStudioNet, STUDIONET_CHAIN_ID, getContractAddress, setContractAddress } from '../config/genlayer';

interface NavbarProps {
  account: string | null;
  balance: string;
  chainId: number | null;
  onConnectWallet: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  balance,
  chainId,
  onConnectWallet,
  onRefresh,
  isRefreshing,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [contractInput, setContractInput] = useState(getContractAddress());
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isCorrectChain = chainId === STUDIONET_CHAIN_ID;

  const handleSaveContract = () => {
    setContractAddress(contractInput);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowConfig(false);
      onRefresh();
    }, 900);
  };

  return (
    <>
      <header className="border-b border-[#2A3B4D] bg-[#0E1721]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-[#15222E] border border-cyan-500/40 shadow-hpc-glow">
              <Server className="w-6 h-6 text-[#38BDF8]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-mono">Agent<span className="text-[#38BDF8]">Lease</span></span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                  DePIN SLA Escrow
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">Autonomous AI Compute & Hashrate Verification</p>
            </div>
          </div>

          {/* Center: Network Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#15222E] border border-[#2A3B4D] text-xs font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${isCorrectChain ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-slate-300">Network:</span>
            <span className={isCorrectChain ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {isCorrectChain ? 'StudioNet (61999)' : 'Wrong Network'}
            </span>
            {!isCorrectChain && (
              <button
                onClick={() => switchToStudioNet()}
                className="ml-2 text-[11px] underline text-cyan-400 hover:text-cyan-300"
              >
                Switch
              </button>
            )}
          </div>

          {/* Right: Actions, Contract Config & Wallet */}
          <div className="flex items-center gap-3">
            
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh on-chain cluster data"
              className="p-2 rounded-lg bg-[#15222E] border border-[#2A3B4D] hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Contract Address Config Button */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Configure Deployed Contract Address"
              className="p-2 rounded-lg bg-[#15222E] border border-[#2A3B4D] hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Wallet Connect */}
            {account ? (
              <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-[#15222E] border border-[#2A3B4D]">
                <div className="hidden sm:flex flex-col text-right font-mono text-xs leading-tight">
                  <span className="text-cyan-300 font-medium">{formatGen(balance)}</span>
                  <span className="text-[10px] text-slate-400">{shortenAddress(account)}</span>
                </div>
                <div className="w-7 h-7 rounded bg-cyan-950 flex items-center justify-center border border-cyan-800 text-cyan-400">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <button
                onClick={onConnectWallet}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-mono text-sm font-medium shadow-hpc-glow transition-all"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Node Wallet</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Contract Config Modal / Drawer */}
      {showConfig && (
        <div className="bg-[#15222E] border-b border-[#2A3B4D] p-4 text-xs font-mono animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Target Deployed Intelligent Contract (Studionet):</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="0x..."
                className="w-full sm:w-96 px-3 py-1.5 rounded bg-[#0B131A] border border-[#2A3B4D] text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
              />
              <button
                onClick={handleSaveContract}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium whitespace-nowrap"
              >
                {saveSuccess ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero balance guidance banner */}
      {account && balance === '0' && (
        <div className="bg-amber-950/70 border-b border-amber-800/80 px-4 py-2 text-xs font-mono text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Your wallet balance is 0 GEN. To lock compute escrow or submit proofs, request test GEN from the Studio faucet:
              </span>
            </div>
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-cyan-300 underline hover:text-cyan-200 whitespace-nowrap font-medium"
            >
              <span>GenLayer Studio Accounts</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </>
  );
};
