import React, { useState } from 'react';
import { Server, Wallet, RefreshCw, Settings, ExternalLink, ShieldCheck, AlertCircle, Copy, Check, Blocks } from 'lucide-react';
import { shortenAddress, formatGen } from '../utils/helpers';
import { switchToStudioNet, STUDIONET_CHAIN_ID, getContractAddress, setContractAddress, STUDIONET_EXPLORER } from '../config/genlayer';

interface NavbarProps {
  account: string | null;
  balance: string;
  chainId: number | null;
  currentBlock: number;
  onConnectWallet: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  balance,
  chainId,
  currentBlock,
  onConnectWallet,
  onRefresh,
  isRefreshing,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [contractInput, setContractInput] = useState(getContractAddress());
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isCorrectChain = chainId === STUDIONET_CHAIN_ID;

  const handleSaveContract = () => {
    setContractAddress(contractInput);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowConfig(false);
      onRefresh();
    }, 800);
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(getContractAddress());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <header className="border-b border-[#223456]/60 bg-[#04070D]/85 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#0C1425] to-[#121D33] border border-[#00F0FF]/30 shadow-quantum-cyan group cursor-pointer">
              <Server className="w-5 h-5 text-[#00F0FF] group-hover:scale-110 transition-transform duration-300" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00F0FF]"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-mono">
                  Agent<span className="text-[#00F0FF]">Lease</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 font-semibold tracking-wider">
                  GenLayer On-Chain
                </span>
              </div>
              <p className="text-xs text-obsidian-400 font-mono hidden sm:block">
                Autonomous AI Compute SLA & Hashrate Verification
              </p>
            </div>
          </div>

          {/* Center: Live On-Chain Telemetry */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Live Block Height Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0C1425] border border-[#223456] text-xs font-mono text-slate-300">
              <Blocks className="w-3.5 h-3.5 text-[#00F0FF] animate-pulse" />
              <span className="text-obsidian-400">Block:</span>
              <span className="text-[#00F0FF] font-semibold">
                {currentBlock > 0 ? `#${currentBlock.toLocaleString()}` : 'Syncing...'}
              </span>
            </div>

            {/* Network Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0C1425] border border-[#223456] text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-obsidian-400">Net:</span>
              <span className={isCorrectChain ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {isCorrectChain ? 'StudioNet (61999)' : 'Wrong Network'}
              </span>
              {!isCorrectChain && (
                <button
                  onClick={() => switchToStudioNet()}
                  className="ml-1 text-[11px] underline text-[#00F0FF] hover:text-cyan-300 font-bold"
                >
                  Switch
                </button>
              )}
            </div>
          </div>

          {/* Right: Contract Switcher & Wallet */}
          <div className="flex items-center gap-3">
            
            {/* Direct Contract Address pill (Copyable) */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0C1425] border border-[#223456] text-xs font-mono text-slate-300">
              <span className="text-obsidian-400">Contract:</span>
              <span className="text-slate-200 font-semibold">{shortenAddress(getContractAddress())}</span>
              <button
                onClick={handleCopyContract}
                className="text-obsidian-400 hover:text-[#00F0FF] transition-colors p-1"
                title="Copy intelligent contract address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh on-chain state"
              className="p-2.5 rounded-xl bg-[#0C1425] border border-[#223456] hover:border-[#00F0FF]/50 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00F0FF]' : ''}`} />
            </button>

            {/* Contract Config Button */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Configure Contract Address"
              className="p-2.5 rounded-xl bg-[#0C1425] border border-[#223456] hover:border-[#00F0FF]/50 text-slate-300 hover:text-white transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Wallet Connect */}
            {account ? (
              <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-gradient-to-r from-[#0C1425] to-[#121D33] border border-[#223456] hover:border-[#00F0FF]/40 transition-all">
                <div className="flex flex-col text-right font-mono text-xs leading-tight">
                  <span className="text-[#00F0FF] font-semibold">{formatGen(balance)}</span>
                  <span className="text-[10px] text-obsidian-400">{shortenAddress(account)}</span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center border border-[#00F0FF]/30 text-[#00F0FF]">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : (
              <button
                onClick={onConnectWallet}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-mono text-xs font-semibold shadow-quantum-cyan transition-all"
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
        <div className="bg-[#0C1425] border-b border-[#223456] p-4 text-xs font-mono animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#00F0FF]" />
              <span>Target Deployed Intelligent Contract on Studionet:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="0x..."
                className="w-full sm:w-96 px-3 py-1.5 rounded-lg bg-[#04070D] border border-[#223456] text-white focus:outline-none focus:border-[#00F0FF] font-mono text-xs"
              />
              <button
                onClick={handleSaveContract}
                className="px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-cyan-400 text-black font-semibold whitespace-nowrap transition-colors"
              >
                {saveSuccess ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero balance alert banner */}
      {account && balance === '0' && (
        <div className="bg-amber-950/80 border-b border-amber-700/60 px-4 py-2 text-xs font-mono text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Your wallet balance is 0 GEN. Please request testnet funds to deploy escrow or submit proofs:
              </span>
            </div>
            <a
              href={`${STUDIONET_EXPLORER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#00F0FF] underline hover:text-cyan-300 whitespace-nowrap font-medium"
            >
              <span>GenLayer Studio Faucet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </>
  );
};
