import React, { useState } from 'react';
import { Wallet, RefreshCw, Settings, ExternalLink, ShieldCheck, AlertCircle, Copy, Check, Coins, Blocks } from 'lucide-react';
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
      <header className="border-b border-[#2C261C] bg-[#0A0B0E]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand (Fintech Luxury Gold Style) */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#1C1810] to-[#121008] border border-[#F5D061]/30 shadow-gold-sm text-[#F5D061]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-sans">
                  Agent<span className="text-[#F5D061]">Lease</span>
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#F5D061]/10 text-[#F5D061] border border-[#F5D061]/30 font-semibold tracking-wider">
                  Compute Escrow Vault
                </span>
              </div>
              <p className="text-xs text-luxury-sandDark font-mono hidden sm:block">
                Autonomous AI Hardware SLA & Hashrate Treasury
              </p>
            </div>
          </div>

          {/* Center: On-Chain Network & Block Status */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14161E] border border-[#2C261C] text-xs font-mono text-luxury-sand">
              <span className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-luxury-sandDark">Network:</span>
              <span className={isCorrectChain ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {isCorrectChain ? 'StudioNet (61999)' : 'Wrong Network'}
              </span>
              {!isCorrectChain && (
                <button
                  onClick={() => switchToStudioNet()}
                  className="ml-1 text-xs text-[#F5D061] hover:underline font-bold"
                >
                  Switch
                </button>
              )}
            </div>

            {currentBlock > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14161E] border border-[#2C261C] text-xs font-mono text-luxury-sand">
                <Blocks className="w-3.5 h-3.5 text-[#F5D061]" />
                <span className="text-luxury-sandDark">Block:</span>
                <span className="text-white font-bold">#{currentBlock.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Right: Contract, Refresh, Settings & Wallet */}
          <div className="flex items-center gap-3">
            
            {/* Copy Contract Address */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14161E] border border-[#2C261C] text-xs font-mono text-luxury-sand">
              <span className="text-luxury-sandDark">Vault:</span>
              <span className="text-[#F5D061] font-semibold">{shortenAddress(getContractAddress())}</span>
              <button
                onClick={handleCopyContract}
                className="text-luxury-sandDark hover:text-[#F5D061] transition-colors p-0.5"
                title="Copy Intelligent Contract address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh ledger state"
              className="p-2.5 rounded-xl bg-[#14161E] border border-[#2C261C] hover:border-[#F5D061]/50 text-luxury-sand hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#F5D061]' : ''}`} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Configure Target Contract"
              className="p-2.5 rounded-xl bg-[#14161E] border border-[#2C261C] hover:border-[#F5D061]/50 text-luxury-sand hover:text-white transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Wallet Button */}
            {account ? (
              <div className="flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#171922] to-[#1E202B] border border-[#383226]">
                <div className="flex flex-col text-right font-mono leading-tight">
                  <span className="text-[#F5D061] font-bold text-xs">{formatGen(balance)}</span>
                  <span className="text-[10px] text-luxury-sandDark">{shortenAddress(account)}</span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#F5D061]/10 text-[#F5D061] flex items-center justify-center border border-[#F5D061]/30">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : (
              <button
                onClick={onConnectWallet}
                className="btn-gold flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans tracking-wide shadow-gold-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Treasury Wallet</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Contract Settings Drawer */}
      {showConfig && (
        <div className="bg-[#111318] border-b border-[#2C261C] p-4 text-xs font-mono animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-luxury-sand">
              <ShieldCheck className="w-4 h-4 text-[#F5D061]" />
              <span>Target Intelligent Contract on Studionet:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="0x..."
                className="w-full sm:w-96 px-3 py-1.5 rounded-lg bg-[#0A0B0E] border border-[#2C261C] text-white focus:outline-none focus:border-[#F5D061] text-xs font-mono"
              />
              <button
                onClick={handleSaveContract}
                className="btn-gold px-4 py-1.5 rounded-lg text-xs whitespace-nowrap"
              >
                {saveSuccess ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero balance guidance banner */}
      {account && balance === '0' && (
        <div className="bg-[#1A1408] border-b border-[#433A2A] px-4 py-2 text-xs font-mono text-[#F5D061]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#F5D061] flex-shrink-0" />
              <span>
                Your treasury balance is 0 GEN. Please request testnet funds to deploy escrow or submit proofs:
              </span>
            </div>
            <a
              href={`${STUDIONET_EXPLORER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-white underline hover:text-[#F5D061] whitespace-nowrap font-medium"
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
