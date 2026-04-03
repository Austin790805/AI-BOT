import React, { useState, useEffect, useRef } from 'react';
import { DerivAPI } from './lib/deriv';
import { Activity, DollarSign, AlertCircle, LogOut, Hash, Clock, CheckCircle2, XCircle, Play, Square, RefreshCw, Moon, Sun } from 'lucide-react';

const deriv = new DerivAPI();

const INDICES = [
  { value: 'R_10', label: 'Volatility 10 Index' },
  { value: 'R_25', label: 'Volatility 25 Index' },
  { value: 'R_50', label: 'Volatility 50 Index' },
  { value: 'R_75', label: 'Volatility 75 Index' },
  { value: 'R_100', label: 'Volatility 100 Index' },
  { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
  { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
  { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
  { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
  { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
  { value: 'R_BEAR', label: 'Bear Market Index' },
  { value: 'R_BULL', label: 'Bull Market Index' },
];

export default function App() {
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<any>(null);
  
  const [isTrading, setIsTrading] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [initialStake, setInitialStake] = useState<string>('1');
  const [currentStake, setCurrentStake] = useState<number>(1);
  const [takeProfit, setTakeProfit] = useState<string>('10');
  const [stopLoss, setStopLoss] = useState<string>('10');
  const [martingale, setMartingale] = useState<string>('2');
  const [maxSteps, setMaxSteps] = useState<string>('5');
  const [symbol, setSymbol] = useState('R_100');
  const [contractType, setContractType] = useState<'EVEN_ODD' | 'OVER_UNDER' | 'RISE_FALL'>('EVEN_ODD');
  const [tradeMode, setTradeMode] = useState<string>('BOTH');
  const [prediction, setPrediction] = useState<string>('4');
  const [ticks, setTicks] = useState<string>('1');
  
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [alertMsg, setAlertMsg] = useState<{type: 'success'|'error'|'info', text: string} | null>(null);
  const [tradeError, setTradeError] = useState('');
  const digitHistoryRef = useRef<number[]>([]);

  const stateRef = useRef({
    isTrading: false,
    isTradeOpen: false,
    currentStake: 1,
    initialStake: 1,
    takeProfit: 10,
    stopLoss: 10,
    martingale: 2,
    maxSteps: 5,
    consecutiveLosses: 0,
    totalProfit: 0,
    symbol: 'R_100',
    contractType: 'EVEN_ODD' as 'EVEN_ODD' | 'OVER_UNDER' | 'RISE_FALL',
    tradeMode: 'BOTH',
    prediction: 4,
    ticks: 1
  });

  useEffect(() => {
    stateRef.current = {
      isTrading,
      isTradeOpen,
      currentStake,
      initialStake: parseFloat(initialStake) || 1,
      takeProfit: parseFloat(takeProfit) || 10,
      stopLoss: parseFloat(stopLoss) || 10,
      martingale: parseFloat(martingale) || 2,
      maxSteps: parseInt(maxSteps) || 5,
      consecutiveLosses: stateRef.current.consecutiveLosses,
      totalProfit,
      symbol,
      contractType,
      tradeMode,
      prediction: parseInt(prediction) || 4,
      ticks: parseInt(ticks) || 1
    };
  }, [isTrading, isTradeOpen, currentStake, initialStake, takeProfit, stopLoss, martingale, maxSteps, totalProfit, symbol, contractType, tradeMode, prediction, ticks]);

  useEffect(() => {
    deriv.onBalanceChange = (bal) => setBalance(bal);
    
    deriv.onTick = async (tick) => {
      const quoteStr = tick.quote.toString();
      const lastDigit = parseInt(quoteStr.slice(-1));

      // Update digit history
      digitHistoryRef.current.push(lastDigit);
      if (digitHistoryRef.current.length > 2) {
        digitHistoryRef.current.shift();
      }

      const state = stateRef.current;
      // Process only tick data when unlocked
      if (!state.isTrading || state.isTradeOpen) return;

      // Decide trade type
      let tradeType = '';
      let barrier: number | undefined = undefined;

      if (state.contractType === 'EVEN_ODD') {
        const history = digitHistoryRef.current;
        if (history.length < 2) return; // Wait for enough data

        const isPrevEven = history[0] % 2 === 0;
        const isCurrEven = history[1] % 2 === 0;

        if (state.tradeMode === 'BOTH') {
          if (isPrevEven && isCurrEven) {
            tradeType = 'DIGITODD';
          } else if (!isPrevEven && !isCurrEven) {
            tradeType = 'DIGITEVEN';
          } else {
            return; // Pattern not met, wait for next tick
          }
        } else if (state.tradeMode === 'TYPE1') {
          // Reversal strategy: Buy Even after 2 consecutive Odds
          if (!isPrevEven && !isCurrEven) {
            tradeType = 'DIGITEVEN';
          } else {
            return;
          }
        } else {
          // Reversal strategy: Buy Odd after 2 consecutive Evens
          if (isPrevEven && isCurrEven) {
            tradeType = 'DIGITODD';
          } else {
            return;
          }
        }
      } else if (state.contractType === 'OVER_UNDER') {
        barrier = state.prediction;
        if (state.tradeMode === 'BOTH') {
          tradeType = lastDigit > state.prediction ? 'DIGITOVER' : 'DIGITUNDER';
        } else if (state.tradeMode === 'TYPE1') {
          tradeType = 'DIGITOVER';
        } else {
          tradeType = 'DIGITUNDER';
        }
      } else if (state.contractType === 'RISE_FALL') {
        if (state.tradeMode === 'BOTH') {
          tradeType = lastDigit > 4 ? 'CALL' : 'PUT';
        } else if (state.tradeMode === 'TYPE1') {
          tradeType = 'CALL';
        } else {
          tradeType = 'PUT';
        }
      }

      // Lock trading immediately
      setIsTradeOpen(true);
      stateRef.current.isTradeOpen = true;

      try {
        // Execute BUY
        const params: any = {
          amount: state.currentStake,
          basis: 'stake',
          contract_type: tradeType,
          currency: 'USD',
          duration: state.ticks,
          duration_unit: 't',
          symbol: state.symbol
        };
        
        if (barrier !== undefined) {
          params.barrier = barrier.toString();
        }

        const res = await deriv.buy(params, state.currentStake);

        if (res.error) throw new Error(res.error.message);
        
        // Subscribe to contract to wait for settlement
        await deriv.subscribeContract(res.buy.contract_id);
      } catch (err: any) {
        setTradeError(err.message);
        // Unlock on error to allow retry
        setIsTradeOpen(false);
        stateRef.current.isTradeOpen = false;
      }
    };

    deriv.onOpenContract = (contract) => {
      if (!contract) return;
      
      // Wait for contract settlement
      if (contract.is_sold) {
        const state = stateRef.current;
        const profit = contract.profit;
        const newTotalProfit = state.totalProfit + profit;
        
        setTotalProfit(newTotalProfit);
        stateRef.current.totalProfit = newTotalProfit;

        setTradeHistory(prev => [{
          id: contract.contract_id,
          type: contract.contract_type,
          stake: contract.buy_price,
          profit: profit,
          status: profit > 0 ? 'WON' : 'LOST',
          date: new Date()
        }, ...prev]);

        if (newTotalProfit >= state.takeProfit) {
          setIsTrading(false);
          stateRef.current.isTrading = false;
          setAlertMsg({ type: 'success', text: `Take Profit reached! Total Profit: $${newTotalProfit.toFixed(2)}` });
          deriv.forgetAll('ticks').catch(()=>{});
        } else if (newTotalProfit <= -state.stopLoss) {
          setIsTrading(false);
          stateRef.current.isTrading = false;
          setAlertMsg({ type: 'error', text: `Stop Loss reached! Total Loss: $${Math.abs(newTotalProfit).toFixed(2)}` });
          deriv.forgetAll('ticks').catch(()=>{});
        } else {
          if (profit > 0) {
            setCurrentStake(state.initialStake);
            stateRef.current.currentStake = state.initialStake;
            stateRef.current.consecutiveLosses = 0;
          } else {
            stateRef.current.consecutiveLosses += 1;
            if (stateRef.current.consecutiveLosses >= state.maxSteps) {
              setCurrentStake(state.initialStake);
              stateRef.current.currentStake = state.initialStake;
              stateRef.current.consecutiveLosses = 0;
              setAlertMsg({ type: 'info', text: `Max Martingale steps (${state.maxSteps}) reached. Stake reset to $${state.initialStake}.` });
            } else {
              const nextStake = state.currentStake * state.martingale;
              setCurrentStake(nextStake);
              stateRef.current.currentStake = nextStake;
            }
          }
        }

        // Unlock to allow next tick trade
        setIsTradeOpen(false);
        stateRef.current.isTradeOpen = false;
      }
    };

    return () => {
      deriv.disconnect();
    };
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a valid token');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await deriv.connect();
      const authRes = await deriv.authorize(token);
      if (authRes.error) {
        throw new Error(authRes.error.message);
      }
      setConnected(true);
      await deriv.subscribeBalance();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      deriv.disconnect();
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    handleStopTrading();
    deriv.disconnect();
    setConnected(false);
    setBalance(null);
    setToken('');
  };

  const handleStopTrading = async (reason?: string) => {
    setIsTrading(false);
    stateRef.current.isTrading = false;
    if (reason) {
      setAlertMsg({ type: 'info', text: reason });
    }
    try {
      await deriv.forgetAll('ticks');
    } catch (e) {}
  };

  const handleStartTrading = async () => {
    setAlertMsg(null);
    setTradeError('');
    
    const numStake = parseFloat(initialStake);
    const numTP = parseFloat(takeProfit);
    const numSL = parseFloat(stopLoss);
    const numMartingale = parseFloat(martingale);
    
    if (isNaN(numStake) || numStake <= 0) return setTradeError('Invalid stake');
    if (isNaN(numTP) || numTP <= 0) return setTradeError('Invalid Take Profit');
    if (isNaN(numSL) || numSL <= 0) return setTradeError('Invalid Stop Loss');
    if (isNaN(numMartingale) || numMartingale <= 0) return setTradeError('Invalid Martingale');

    setCurrentStake(numStake);
    setIsTrading(true);
    stateRef.current.isTrading = true;
    stateRef.current.currentStake = numStake;
    
    try {
      await deriv.forgetAll('ticks');
      await deriv.subscribeTicks(symbol);
    } catch (err: any) {
      setTradeError('Failed to subscribe to ticks: ' + err.message);
      setIsTrading(false);
      stateRef.current.isTrading = false;
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold tracking-tight">💲 PHYNIX BOT AI</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          {connected && balance && (
            <>
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full font-medium text-sm transition-colors duration-200">
                <DollarSign className="w-4 h-4" />
                {balance.balance} {balance.currency}
              </div>
              <button 
                onClick={handleDisconnect}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Disconnect"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {!connected ? (
          <div className="max-w-md mx-auto mt-20 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <h2 className="text-2xl font-semibold mb-2">Connect to Deriv</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Enter your Deriv API token to start trading Even/Odd contracts.</p>
            
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter your token..."
                  required
                />
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Parameters */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
                <h3 className="text-lg font-semibold mb-4">Bot Parameters</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    >
                      {INDICES.map(idx => (
                        <option key={idx.value} value={idx.value}>{idx.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contract Type</label>
                    <select
                      value={contractType}
                      onChange={(e) => {
                        setContractType(e.target.value as any);
                        setTradeMode('BOTH');
                      }}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    >
                      <option value="EVEN_ODD">Even / Odd</option>
                      <option value="OVER_UNDER">Over / Under</option>
                      <option value="RISE_FALL">Rise / Fall</option>
                    </select>
                  </div>

                  {contractType === 'OVER_UNDER' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prediction (0-9)</label>
                      <input
                        type="number" min="0" max="9" step="1"
                        value={prediction}
                        onChange={(e) => setPrediction(e.target.value)}
                        disabled={isTrading}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade Mode</label>
                    <select
                      value={tradeMode}
                      onChange={(e) => setTradeMode(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    >
                      {contractType === 'EVEN_ODD' ? (
                        <option value="BOTH">Pattern (EE &rarr; O, OO &rarr; E)</option>
                      ) : (
                        <option value="BOTH">Both (Alternating/Dynamic)</option>
                      )}
                      {contractType === 'EVEN_ODD' && (
                        <>
                          <option value="TYPE1">Even Only (OO &rarr; E)</option>
                          <option value="TYPE2">Odd Only (EE &rarr; O)</option>
                        </>
                      )}
                      {contractType === 'OVER_UNDER' && (
                        <>
                          <option value="TYPE1">Over Only</option>
                          <option value="TYPE2">Under Only</option>
                        </>
                      )}
                      {contractType === 'RISE_FALL' && (
                        <>
                          <option value="TYPE1">Rise Only</option>
                          <option value="TYPE2">Fall Only</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Stake (USD)</label>
                    <input
                      type="number" min="0.35" step="0.01"
                      value={initialStake}
                      onChange={(e) => setInitialStake(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (Ticks)</label>
                    <input
                      type="number" min="1" max="10" step="1"
                      value={ticks}
                      onChange={(e) => setTicks(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Take Profit (USD)</label>
                    <input
                      type="number" min="0" step="1"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stop Loss (USD)</label>
                    <input
                      type="number" min="0" step="1"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Martingale Multiplier</label>
                    <input
                      type="number" min="1" step="0.1"
                      value={martingale}
                      onChange={(e) => setMartingale(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Martingale Steps</label>
                    <input
                      type="number" min="1" step="1"
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(e.target.value)}
                      disabled={isTrading}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 transition-colors"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Resets stake to initial after this many consecutive losses.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Controls & History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Controls & Status */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Bot Control</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                      {isTrading ? (
                        <span className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                          <Activity className="w-4 h-4 animate-pulse" /> Running
                          {isTradeOpen ? ' (Trade Open)' : ' (Waiting for Tick)'}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Stopped</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    {!isTrading ? (
                      <button
                        onClick={handleStartTrading}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                      >
                        <Play className="w-4 h-4" /> Start Bot
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStopTrading('Bot stopped manually.')}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                      >
                        <Square className="w-4 h-4" /> Stop Bot
                      </button>
                    )}
                  </div>
                </div>

                {alertMsg && (
                  <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
                    alertMsg.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                    alertMsg.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                    'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                  }`}>
                    {alertMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> :
                     alertMsg.type === 'error' ? <XCircle className="w-5 h-5 shrink-0" /> :
                     <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="font-medium">{alertMsg.text}</p>
                  </div>
                )}

                {tradeError && (
                  <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-medium">{tradeError}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Current Stake</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${currentStake.toFixed(2)}</p>
                  </div>
                  <div className={`p-4 rounded-xl border transition-colors ${totalProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                    <p className={`text-sm font-medium mb-1 ${totalProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>Total Profit</p>
                    <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {totalProfit >= 0 ? '+' : '-'}${Math.abs(totalProfit).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trade History */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Trade History</h3>
                  <button
                    onClick={() => { setTradeHistory([]); setTotalProfit(0); }}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Reset
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 transition-colors">
                      <tr>
                        <th className="px-4 py-3 rounded-l-lg font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Stake</th>
                        <th className="px-4 py-3 rounded-r-lg font-medium text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {tradeHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            No trades executed yet.
                          </td>
                        </tr>
                      ) : (
                        tradeHistory.map((trade, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                              {trade.date.toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                ['DIGITEVEN', 'DIGITOVER', 'CALL'].includes(trade.type) ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {trade.type.replace('DIGIT', '')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium">
                              ${trade.stake.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${trade.profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
