import React, { useState } from 'react';
import { Cpu, Wallet, RefreshCw, Settings, ExternalLink, ShieldCheck, AlertCircle, Copy, Check, Terminal } from 'lucide-react';
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
    }, 700);
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(getContractAddress());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <header className="border-b border-gray-800 bg-[#0B0F19]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Brand (RunPod / Lambda Labs Style) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight text-white font-sans">
                Agent<span className="text-blue-500">Lease</span>
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 font-medium">
                Cloud Console
              </span>
            </div>
          </div>

          {/* Center: Network & Block Status */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-900 border border-gray-800 text-xs font-mono text-gray-300">
              <span className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>{isCorrectChain ? 'StudioNet (61999)' : 'Wrong Network'}</span>
              {!isCorrectChain && (
                <button
                  onClick={() => switchToStudioNet()}
                  className="ml-1.5 text-blue-400 hover:text-blue-300 font-semibold underline"
                >
                  Switch
                </button>
              )}
            </div>

            {currentBlock > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-900 border border-gray-800 text-xs font-mono text-gray-400">
                <span className="text-gray-500">Block:</span>
                <span className="text-white font-semibold">#{currentBlock.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Right: Contract Config, Refresh & Wallet */}
          <div className="flex items-center gap-2.5">
            
            {/* Copy Contract Address */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-900 border border-gray-800 text-xs font-mono text-gray-300">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-gray-400">Contract:</span>
              <span className="text-gray-200">{shortenAddress(getContractAddress())}</span>
              <button
                onClick={handleCopyContract}
                className="text-gray-400 hover:text-blue-400 p-0.5 transition-colors"
                title="Copy intelligent contract address"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh state"
              className="p-2 rounded-md bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Configure Target Contract"
              className="p-2 rounded-md bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Wallet Button */}
            {account ? (
              <div className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs font-mono">
                <div className="flex flex-col text-right leading-tight">
                  <span className="text-blue-400 font-semibold">{formatGen(balance)}</span>
                  <span className="text-[10px] text-gray-400">{shortenAddress(account)}</span>
                </div>
                <div className="w-6 h-6 rounded bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Wallet className="w-3 h-3" />
                </div>
              </div>
            ) : (
              <button
                onClick={onConnectWallet}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Wallet</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Contract Settings Drawer */}
      {showConfig && (
        <div className="bg-[#111827] border-b border-gray-800 p-4 text-xs font-mono">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-300">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Target Deployed Intelligent Contract on Studionet:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="0x..."
                className="w-full sm:w-96 px-3 py-1.5 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
              <button
                onClick={handleSaveContract}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                {saveSuccess ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero balance alert banner */}
      {account && balance === '0' && (
        <div className="bg-amber-950/60 border-b border-amber-800/60 px-4 py-2 text-xs font-mono text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Your balance is 0 GEN. To deploy compute escrow or submit benchmark proofs, claim test tokens from the Studio Faucet:
              </span>
            </div>
            <a
              href={`${STUDIONET_EXPLORER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 underline hover:text-blue-300 whitespace-nowrap font-medium"
            >
              <span>GenLayer Studio Accounts Faucet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </>
  );
};
