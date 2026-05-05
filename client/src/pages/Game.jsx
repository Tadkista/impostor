import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { useAuth } from '../context/AuthContext';

// Short beep sound via Web Audio API — no external files needed
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // Audio not supported — silent fallback
  }
};

export default function Game() {
  const { code } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState(null);
  const [roleInfo, setRoleInfo] = useState(null);
  const [showRolePopup, setShowRolePopup] = useState(false);
  const [showWord, setShowWord] = useState(false);
  const [hasConfirmedReady, setHasConfirmedReady] = useState(false);

  const [turnTimer, setTurnTimer] = useState(0);
  const turnIntervalRef = useRef(null);

  // Finish confirmation state
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [frozenTime, setFrozenTime] = useState(null);

  const [hostDecisionRequest, setHostDecisionRequest] = useState(null);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [votingResults, setVotingResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [roomClosed, setRoomClosed] = useState(false);

  const [showAddLocalPlayer, setShowAddLocalPlayer] = useState(false);
  const [localPlayerNick, setLocalPlayerNick] = useState('');

  const addLog = (msg) => setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg }].slice(-10));

  useEffect(() => {
    socket.removeAllListeners();
    socket.auth = { token };
    if (!socket.connected) socket.connect();

    const joinTimeout = setTimeout(() => socket.emit('join_room', { code }), 300);

    socket.on('connect', () => socket.emit('join_room', { code }));

    socket.on('room_update', (state) => {
      if (state && state.players) setGameState(state);
    });

    socket.on('game_started', (data) => addLog(data.message));

    socket.on('game_start_info', (data) => {
      setRoleInfo(data);
      setShowRolePopup(true);
      setShowWord(false);
      setHasConfirmedReady(false);
    });

    socket.on('turn_started', (data) => {
      setShowFinishConfirm(false);
      setFrozenTime(null);
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentPlayerIndex: prev.players.findIndex(p => p.userId === data.currentPlayerId),
          turnStartTime: data.turnStartTime,
          isLastRound: data.isLastRound,
          roundMultiplier: data.roundMultiplier,
          status: 'playing'
        };
      });
      if (turnIntervalRef.current) clearInterval(turnIntervalRef.current);
      const startTime = data.turnStartTime;
      turnIntervalRef.current = setInterval(() => {
        setTurnTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    });

    socket.on('game:timer-paused', (data) => {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      setTurnTimer(Math.floor(data.accumulatedTime / 1000));
    });

    socket.on('game:timer-resume', (data) => {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      const { turnStartTime, accumulatedTime } = data;
      turnIntervalRef.current = setInterval(() => {
        setTurnTimer(Math.floor(accumulatedTime / 1000) + Math.floor((Date.now() - turnStartTime) / 1000));
      }, 1000);
    });

    socket.on('game:host-decision', (data) => {
      setHostDecisionRequest(data);
      playBeep();
    });

    socket.on('approval_request', (data) => setApprovalRequest(data));

    socket.on('approval_result', (data) => {
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      setTurnTimer(0);
      setApprovalRequest(null);
      setShowFinishConfirm(false);
      setFrozenTime(null);
      const pts = data.pointsEarned;
      addLog(`${data.approved ? '✓ Zatwierdzone' : '✗ Odrzucone'}: ${pts > 0 ? '+' : ''}${pts} pkt`);
    });

    socket.on('voting_started', (data) => {
      addLog(data.message);
      setGameState(prev => prev ? { ...prev, status: 'voting' } : prev);
    });

    socket.on('voting_results', (data) => {
      setVotingResults(data);
      setGameState(prev => prev ? { ...prev, status: 'finished' } : prev);
    });

    socket.on('game_finished', (data) => {
      addLog(data.message);
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
    });

    socket.on('leaderboard_update', () => addLog('Ranking zaktualizowany'));

    socket.on('error', (msg) => addLog('⚠ ' + msg));
    socket.on('disconnect', () => addLog('Rozłączono z serwerem'));
    socket.on('room:closed', () => setRoomClosed(true));

    return () => {
      clearTimeout(joinTimeout);
      if (turnIntervalRef.current) { clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      socket.emit('leave_room', { code });
      socket.off('connect'); socket.off('room_update'); socket.off('game_started');
      socket.off('game_start_info'); socket.off('turn_started'); socket.off('approval_request');
      socket.off('approval_result'); socket.off('voting_started'); socket.off('voting_results');
      socket.off('game_finished'); socket.off('leaderboard_update'); socket.off('error');
      socket.off('disconnect'); socket.off('room:closed');
      socket.off('game:timer-paused'); socket.off('game:timer-resume'); socket.off('game:host-decision');
      socket.disconnect();
    };
  }, [code, token]);

  const handleStartGame   = () => socket.emit('start_game',   { code });
  const handleCloseRoom   = () => socket.emit('close_room',   { code });
  const handleHostApprove = (approved) => { socket.emit('host_approve', { code, approved }); setApprovalRequest(null); };
  const handleTriggerBonus = () => socket.emit('trigger_bonus', { code });
  const handleStartVoting  = () => socket.emit('start_voting', { code });
  const handleCastVote     = (targetId) => socket.emit('cast_vote', { code, targetId });

  // Ready confirmation — close popup and emit to server
  const handleConfirmReady = useCallback(() => {
    setShowRolePopup(false);
    setHasConfirmedReady(true);
    socket.emit('game_ready', { code });
  }, [code]);

  // "Skończyłem" — freeze timer, show confirmation, play sound
  const handleFinishClick = useCallback(() => {
    if (showFinishConfirm) return; // already showing
    setFrozenTime(turnTimer);
    setShowFinishConfirm(true);
    playBeep();
    socket.emit('game:pause-request', { code });
  }, [turnTimer, showFinishConfirm, code]);

  // Confirm finish — send to server
  const handleFinishConfirm = useCallback(() => {
    setShowFinishConfirm(false);
    socket.emit('player_finished', { code });
  }, [code]);

  // Cancel finish — resume timer
  const handleFinishCancel = useCallback(() => {
    setShowFinishConfirm(false);
    setFrozenTime(null);
    socket.emit('game:timer-resume', { code });
  }, [code]);

  const handleHostDecisionSubmit = useCallback((allow) => {
    setHostDecisionRequest(null);
    socket.emit('game:host-decision', { code, allow });
  }, [code]);

  if (!gameState) return (
    <div className="text-center mt-12">
      <p className="text-muted text-lg">Łączenie z pokojem...</p>
      <p className="text-muted text-sm mt-2">Pokój: {code}</p>
    </div>
  );

  const myUserId = user._id || user.id;
  const isHost = gameState.hostId === myUserId;
  const myDevice = gameState.devices?.[myUserId];
  const activeLocalPlayerId = myDevice ? myDevice.activePlayerId : myUserId;
  const localPlayerIds = myDevice ? myDevice.playerIds : [myUserId];

  let needsSwitchTo = null;
  if (myDevice) {
    if (gameState.status === 'confirming') {
      const unconfirmedLocal = localPlayerIds.find(id => !gameState.readyPlayers.includes(id));
      if (unconfirmedLocal && unconfirmedLocal !== activeLocalPlayerId) {
        needsSwitchTo = unconfirmedLocal;
      }
    } else if (gameState.status === 'playing') {
      const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.userId;
      if (localPlayerIds.includes(currentPlayerId) && activeLocalPlayerId !== currentPlayerId) {
        needsSwitchTo = currentPlayerId;
      }
    } else if (gameState.status === 'voting') {
      const unvotedLocal = localPlayerIds.find(id => {
        const p = gameState.players.find(x => x.userId === id);
        return p && !p.votedFor;
      });
      if (unvotedLocal && unvotedLocal !== activeLocalPlayerId) {
        needsSwitchTo = unvotedLocal;
      }
    }
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.status === 'playing' && currentPlayer?.userId === activeLocalPlayerId;
  const me = gameState.players.find(p => p.userId === activeLocalPlayerId);
  const isImpostor = roleInfo?.role === 'impostor';
  const displayTimer = frozenTime !== null ? frozenTime : turnTimer;

  if (roomClosed) return (
    <div className="text-center mt-12">
      <p className="text-text font-semibold text-lg mb-2">Pokój został zamknięty przez hosta.</p>
      <p className="text-muted text-sm mb-6">Zostałeś rozłączony z pokojem.</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>Powrót do strony głównej</button>
    </div>
  );

  if (needsSwitchTo) {
    const targetPlayer = gameState.players.find(p => p.userId === needsSwitchTo);
    return (
      <div className="fixed inset-0 bg-blue-600 flex flex-col items-center justify-center z-50 p-6 text-white space-y-8">
        <h2 className="text-3xl font-bold">Kolej gracza:</h2>
        <p className="text-5xl font-extrabold">{targetPlayer?.nick}</p>
        <button
          className="btn py-4 px-12 text-2xl font-bold bg-green-500 hover:bg-green-600 text-white border-0 shadow-lg"
          onClick={() => socket.emit('device:next-player', { code, targetUserId: needsSwitchTo })}
        >
          DALEJ
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-4 space-y-4 pb-12">

      {/* Role popup — "Rozumiem" now emits game_ready */}
      {showRolePopup && roleInfo && (
        <div className="fixed inset-0 bg-background/90 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm border-2 border-primary text-center space-y-4">
            <h2 className="text-2xl font-bold text-primary">
              {isImpostor ? '🕵️ Jesteś Impostorem' : '👤 Jesteś Graczem'}
            </h2>

            {isImpostor ? (
              <>
                <p className="text-muted text-sm">Nie znasz słowa. Staraj się nie wyjść na jaw!</p>
                <div className="bg-surface border border-border p-3 rounded text-left space-y-2">
                  <p className="text-xs text-muted">Twoja podpowiedź</p>
                  <p className="font-mono text-lg">{roleInfo.impostorHint}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted text-sm">Opisuj poniższe hasło nie wymawiając go!</p>
                <div className="bg-surface border border-border p-3 rounded text-left space-y-2">
                  <p className="text-xs text-muted">Tajne hasło</p>
                  <p className="font-mono font-bold text-xl text-primary tracking-widest">{roleInfo.password}</p>
                </div>
              </>
            )}

            <button className="btn btn-primary w-full py-3" onClick={handleConfirmReady}>
              Rozumiem
            </button>
          </div>
        </div>
      )}

      {/* Finish confirmation popup */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm border-2 border-primary text-center space-y-4">
            <h3 className="text-xl font-bold">Czy na pewno chcesz zakończyć?</h3>
            <p className="text-muted text-sm">Twój czas: <span className="font-mono font-bold text-primary">{frozenTime}s</span></p>
            <div className="flex gap-4">
              <button className="btn btn-primary flex-1 py-3" onClick={handleFinishConfirm}>
                Tak
              </button>
              <button className="btn btn-secondary flex-1 py-3" onClick={handleFinishCancel}>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center card p-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Pokój: <span className="font-mono">{code}</span></h1>
          <p className="text-muted text-sm">Status: {gameState.status === 'confirming' ? 'POTWIERDZANIE' : gameState.status.toUpperCase()}</p>
        </div>
        <div className="text-right flex items-center gap-2">
          {gameState.isLastRound && (
            <span className="bg-accent text-white text-xs px-2 py-1 rounded font-bold">BONUS 2×</span>
          )}
          {isHost ? (
            <button
              className="btn btn-secondary text-sm border-red-500 text-red-500"
              onClick={() => { if (window.confirm('Zamknąć pokój i rozłączyć wszystkich graczy?')) handleCloseRoom(); }}
            >
              Zamknij pokój
            </button>
          ) : (
            <button className="btn btn-secondary text-sm" onClick={() => navigate('/')}>Opuść</button>
          )}
        </div>
      </div>

      {/* Confirming phase — waiting for all players to click "Rozumiem" */}
      {gameState.status === 'confirming' && (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm mb-2">Oczekiwanie na potwierdzenie wszystkich graczy...</p>
          <p className="text-2xl font-bold text-primary font-mono">
            {gameState.readyCount} / {gameState.totalPlayers}
          </p>
          <p className="text-muted text-xs mt-2">
            {hasConfirmedReady ? 'Potwierdziłeś gotowość ✓' : 'Kliknij „Rozumiem" w okienku z rolą'}
          </p>
        </div>
      )}

      {/* Role bar (during play/voting) */}
      {(gameState.status === 'playing' || gameState.status === 'voting') && roleInfo && (
        <div className="card p-3 flex items-center justify-between gap-3">
          <span className="text-sm text-muted font-medium">
            {isImpostor ? '🕵️ Impostor' : '👤 Gracz'}
          </span>
          {isImpostor ? (
            <span className="text-sm text-muted font-mono">Podpowiedź: {roleInfo.impostorHint}</span>
          ) : (
            <button
              className="btn btn-secondary text-sm select-none"
              onMouseDown={() => setShowWord(true)}
              onMouseUp={() => setShowWord(false)}
              onMouseLeave={() => setShowWord(false)}
              onTouchStart={() => setShowWord(true)}
              onTouchEnd={() => setShowWord(false)}
            >
              {showWord ? (
                <span className="font-bold text-primary tracking-wide">{roleInfo.password}</span>
              ) : (
                'Przytrzymaj by pokazać hasło'
              )}
            </button>
          )}
        </div>
      )}

      {/* Waiting lobby */}
      {gameState.status === 'waiting' && isHost && (
        <div className="card p-4 flex justify-between items-center">
          <span className="font-medium">
            Gracze: {gameState.players.length} / {gameState.settings.maxPlayers}
          </span>
          <button
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={gameState.players.length < 3}
            title={gameState.players.length < 3 ? 'Potrzeba co najmniej 3 graczy' : ''}
          >
            Rozpocznij grę
          </button>
        </div>
      )}

      {gameState.status === 'waiting' && !isHost && (
        <div className="card p-6 text-center text-muted">
          Oczekiwanie na start hosta... ({gameState.players.length} / {gameState.settings.maxPlayers} graczy)
        </div>
      )}

      {/* Local Player Addition */}
      {gameState.status === 'waiting' && gameState.settings?.multiDeviceMode && (
        <div className="card p-4 mt-4 text-center">
          <p className="text-sm text-muted mb-3">Grasz ze znajomymi na jednym urządzeniu?</p>
          <button className="btn btn-secondary w-full" onClick={() => setShowAddLocalPlayer(true)}>
            Dodaj kolejną osobę
          </button>
        </div>
      )}

      {showAddLocalPlayer && (
        <div className="fixed inset-0 bg-background/90 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm border-2 border-primary space-y-4">
            <h3 className="text-xl font-bold text-primary">Nick drugiej osoby</h3>
            <input 
              type="text" 
              className="input w-full" 
              placeholder="Wpisz nick..." 
              value={localPlayerNick} 
              onChange={e => setLocalPlayerNick(e.target.value)} 
            />
            <div className="flex gap-2">
              <button 
                className="btn btn-primary flex-1" 
                onClick={() => {
                  if (localPlayerNick.trim()) {
                    socket.emit('add_local_player', { code, nick: localPlayerNick.trim() });
                    setLocalPlayerNick('');
                    setShowAddLocalPlayer(false);
                  }
                }}
              >
                Dodaj
              </button>
              <button className="btn btn-secondary flex-1" onClick={() => setShowAddLocalPlayer(false)}>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playing phase */}
      {gameState.status === 'playing' && (
        <div className="card p-6">
          <div className="text-center py-4 border-b border-border mb-4">
            <p className="text-sm text-muted mb-1">Aktualna tura</p>
            <div className="text-3xl font-bold text-primary mb-2">{currentPlayer?.nick ?? '—'}</div>
            <div className="text-5xl font-mono font-bold text-text">{displayTimer}s</div>
          </div>

          {isMyTurn ? (
            <button
              className="btn btn-primary w-full py-3 text-base mt-2"
              onClick={handleFinishClick}
              disabled={showFinishConfirm}
            >
              Skończyłem
            </button>
          ) : (
            <p className="text-center text-muted text-sm mt-2">Poczekaj na swoją turę...</p>
          )}

          <div className="flex gap-2 justify-center mt-4 pt-4 border-t border-border flex-wrap">
            {!me?.wantToVote ? (
              <button className="btn btn-secondary text-sm" onClick={handleStartVoting}>
                Zagłosuj ({gameState.players.filter(p => p.wantToVote).length}/{gameState.players.length})
              </button>
            ) : (
              <span className="text-sm text-muted">Oczekiwanie na głosowanie wszystkich...</span>
            )}
            {isHost && !gameState.bonusTriggered && !gameState.isLastRound && (
              <button className="btn btn-secondary text-sm" onClick={handleTriggerBonus}>
                Uruchom rundę bonusową
              </button>
            )}
            {gameState.bonusTriggered && !gameState.isLastRound && (
              <span className="text-sm text-primary font-medium">Runda bonusowa w kolejce!</span>
            )}
          </div>
        </div>
      )}

      {/* Host Approval popup */}
      {isHost && approvalRequest && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm border-2 border-primary">
            <h3 className="text-xl font-bold mb-1 text-center">Zatwierdź turę?</h3>
            <p className="text-center text-muted mb-6">{approvalRequest.nick} twierdzi, że skończył</p>
            <div className="flex gap-4">
              <button className="btn flex-1 py-3 bg-green-600 text-white hover:bg-green-700 border-0" onClick={() => handleHostApprove(true)}>
                Zatwierdź
              </button>
              <button className="btn flex-1 py-3 bg-red-600 text-white hover:bg-red-700 border-0" onClick={() => handleHostApprove(false)}>
                Odrzuć (−2500)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host Decision popup (Time expired) */}
      {isHost && hostDecisionRequest && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm border-2 border-accent text-center space-y-4">
            <h3 className="text-xl font-bold text-accent">Koniec czasu!</h3>
            <p className="text-muted">{hostDecisionRequest.message}</p>
            <div className="flex gap-4">
              <button className="btn btn-primary flex-1 py-3" onClick={() => handleHostDecisionSubmit(true)}>
                Tak
              </button>
              <button className="btn btn-secondary flex-1 py-3 border-accent text-accent" onClick={() => handleHostDecisionSubmit(false)}>
                Nie (Koniec)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voting phase */}
      {gameState.status === 'voting' && !votingResults && (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-2 text-primary text-center">Zagłosuj na Impostora</h2>
          <p className="text-center text-muted text-sm mb-6">Kto Twoim zdaniem jest Impostorem?</p>
          {me?.votedFor ? (
            <p className="text-center text-muted py-4">
              Zagłosowałeś. Czekaj na pozostałych... ({gameState.players.filter(p => p.votedFor).length}/{gameState.players.length})
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {gameState.players.filter(p => p.userId !== activeLocalPlayerId).map(p => (
                <button key={p.userId} className="btn btn-secondary py-4 text-base" onClick={() => handleCastVote(p.userId)}>
                  {p.nick}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Voting results */}
      {votingResults && (
        <div className="card p-6 space-y-4">
          <h2 className="text-2xl font-bold text-primary text-center">Koniec gry</h2>
          <p className="text-lg text-center">
            {votingResults.isCorrect
              ? <span className="text-green-500 font-bold">Impostor złapany! 🎉</span>
              : <span className="text-accent font-bold">Impostor uciekł! 😈</span>}
          </p>

          <div className="pt-4 border-t border-border text-center">
            <p className="text-muted text-sm mb-2">Impostorem był(a):</p>
            {gameState.players
              .filter(p => votingResults.impostors.includes(p.userId))
              .map(p => <div key={p.userId} className="font-bold text-accent text-xl">{p.nick}</div>)}
          </div>

          {votingResults.playerResults && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center text-xs text-muted uppercase tracking-wide px-2 pb-2">
                <span className="flex-1">Gracz</span>
                <span className="w-20 text-right">Gra</span>
                <span className="w-20 text-right">Głos</span>
              </div>
              <ul className="divide-y divide-border">
                {votingResults.playerResults.map(pr => (
                  <li key={pr.userId} className="flex items-center px-2 py-2 text-sm">
                    <span className={`flex-1 font-medium ${pr.isImpostor ? 'text-accent' : 'text-text'}`}>
                      {pr.nick}
                      {pr.isImpostor && <span className="text-xs text-accent ml-1">(Impostor)</span>}
                      {localPlayerIds.includes(pr.userId) && <span className="text-xs text-primary ml-1">(Twoje)</span>}
                    </span>
                    <span className={`w-20 text-right font-mono ${pr.gamePoints < 0 ? 'text-accent' : 'text-muted'}`}>
                      {pr.gamePoints >= 0 ? '+' : ''}{pr.gamePoints}
                    </span>
                    <span className={`w-20 text-right font-mono ${pr.globalPointsDelta < 0 ? 'text-accent' : pr.globalPointsDelta > 0 ? 'text-green-500' : 'text-muted'}`}>
                      {pr.globalPointsDelta >= 0 ? '+' : ''}{pr.globalPointsDelta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <button className="btn btn-primary" onClick={() => navigate('/')}>Strona główna</button>
            <button className="btn btn-secondary" onClick={() => navigate('/leaderboard')}>Ranking</button>
          </div>
        </div>
      )}

      {/* Players + Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-bold border-b border-border pb-2 mb-3 text-sm text-muted uppercase tracking-wide">Gracze</h3>
          <ul className="space-y-2">
            {gameState.players.map((p, idx) => (
              <li key={p.userId} className="flex justify-between items-center text-sm">
                <span className={`flex items-center gap-2 ${p.online ? 'text-text' : 'text-muted line-through'}`}>
                  {gameState.status === 'playing' && idx === gameState.currentPlayerIndex && (
                    <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  )}
                  {p.nick}
                  {p.userId === gameState.hostId && <span className="text-xs text-muted">(Host)</span>}
                  {localPlayerIds.includes(p.userId) && <span className="text-xs text-primary">(Twoje)</span>}
                </span>
                <span className={`font-mono font-medium ${p.score < 0 ? 'text-accent' : 'text-primary'}`}>
                  {p.score >= 0 ? '+' : ''}{p.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="font-bold border-b border-border pb-2 mb-3 text-sm text-muted uppercase tracking-wide">Dziennik gry</h3>
          <ul className="text-xs space-y-1 text-muted font-mono h-28 overflow-y-auto flex flex-col-reverse">
            {[...logs].reverse().map(l => <li key={l.id}>{l.msg}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
