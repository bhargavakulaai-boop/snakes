import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, Trophy } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const GAME_SPEED = 100; // ms per tick

const TRACKS = [
  { id: 1, title: 'Neon Drive (Synthwave)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'Cyber City (Retrowave)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: 'Digital Horizon (Chiptune)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

export default function App() {
  // Game State
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  
  // Canvas & Game Loop Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  // Game Logic Refs (to avoid dependency cycles in requestAnimationFrame)
  const snakeRef = useRef(INITIAL_SNAKE);
  const directionRef = useRef(INITIAL_DIRECTION);
  const lastProcessedDirectionRef = useRef(INITIAL_DIRECTION);
  const foodRef = useRef({ x: 15, y: 5 });
  const isGameRunningRef = useRef(false);
  const gameOverRef = useRef(false);

  // Music State
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync refs with state for game loop
  useEffect(() => { isGameRunningRef.current = isGameRunning; }, [isGameRunning]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);

  const spawnFood = (currentSnake: {x: number, y: number}[]) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      if (!currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    return newFood;
  };

  const resetGame = () => {
    snakeRef.current = INITIAL_SNAKE;
    directionRef.current = INITIAL_DIRECTION;
    lastProcessedDirectionRef.current = INITIAL_DIRECTION;
    setScore(0);
    setGameOver(false);
    setIsGameRunning(false);
    foodRef.current = spawnFood(INITIAL_SNAKE);
    drawGame();
  };

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / GRID_SIZE;

    // Clear canvas
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);

    // Draw Food
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff00ff';
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * cellSize + cellSize / 2,
      foodRef.current.y * cellSize + cellSize / 2,
      cellSize / 2 - 2,
      0,
      2 * Math.PI
    );
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow

    // Draw Snake
    const snake = snakeRef.current;
    snake.forEach((segment, i) => {
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = i === 0 ? 10 : 5;
      ctx.shadowColor = '#39ff14';
      
      const opacity = Math.max(0.1, 1 - (i / snake.length));
      ctx.globalAlpha = opacity;
      
      const scale = Math.max(0.4, 1 - (i / snake.length) * 0.5);
      const size = (cellSize - 2) * scale;
      const offset = (cellSize - size) / 2;

      ctx.fillRect(
        segment.x * cellSize + offset,
        segment.y * cellSize + offset,
        size,
        size
      );
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }, []);

  const updateGame = useCallback(() => {
    if (!isGameRunningRef.current || gameOverRef.current) return;

    const head = snakeRef.current[0];
    const direction = directionRef.current;
    const newHead = { x: head.x + direction.x, y: head.y + direction.y };
    lastProcessedDirectionRef.current = direction;

    // Check collision with walls
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      setGameOver(true);
      setIsGameRunning(false);
      return;
    }

    // Check collision with self
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      setGameOver(true);
      setIsGameRunning(false);
      return;
    }

    const newSnake = [newHead, ...snakeRef.current];

    // Check food collision
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      setScore(s => s + 10);
      foodRef.current = spawnFood(newSnake);
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  }, []);

  const gameLoop = useCallback((time: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
    }
    const deltaTime = time - lastTimeRef.current;

    if (deltaTime >= GAME_SPEED) {
      updateGame();
      drawGame();
      lastTimeRef.current = time;
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, drawGame]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  // Handle ResizeObserver for Canvas
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Make it square based on the smaller dimension
        const size = Math.min(width, height);
        if (canvasRef.current) {
          canvasRef.current.width = size;
          canvasRef.current.height = size;
          drawGame(); // Redraw immediately on resize
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [drawGame]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
    }
  }, [score, highScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
      if (keys.includes(e.key)) {
        e.preventDefault();
      }
      
      if (!isGameRunningRef.current && !gameOverRef.current && keys.includes(e.key)) {
         setIsGameRunning(true);
      }

      const lastDir = lastProcessedDirectionRef.current;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          if (lastDir.y !== 1) directionRef.current = { x: 0, y: -1 };
          break;
        case 'arrowdown':
        case 's':
          if (lastDir.y !== -1) directionRef.current = { x: 0, y: 1 };
          break;
        case 'arrowleft':
        case 'a':
          if (lastDir.x !== 1) directionRef.current = { x: -1, y: 0 };
          break;
        case 'arrowright':
        case 'd':
          if (lastDir.x !== -1) directionRef.current = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Music Controls
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar Playlist */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-800 p-6 flex flex-col gap-4 bg-[#050505] z-10">
        <div className="font-mono text-[10px] uppercase tracking-[4px] text-fuchsia-500 mb-2">Playlist</div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {TRACKS.map((track, i) => {
            const titleParts = track.title.split(' (');
            const name = titleParts[0];
            const artist = titleParts[1]?.replace(')', '') || 'UNKNOWN';
            const isActive = currentTrack === i;
            return (
              <div 
                key={track.id} 
                className={`p-3 border cursor-pointer transition-all ${
                  isActive 
                    ? 'border-cyan-400 bg-cyan-400/10' 
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
                onClick={() => {
                  setCurrentTrack(i);
                  setIsPlaying(true);
                }}
              >
                <div className="text-sm font-medium mb-1">{name}</div>
                <div className="font-mono text-[10px] text-cyan-400">{artist}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Header Stats */}
        <div className="absolute top-6 right-8 text-right z-10">
          <div className="text-6xl md:text-8xl font-black leading-none text-green-400 drop-shadow-[0_0_10px_rgba(57,255,20,0.8)]">
            {score.toString().padStart(3, '0')}
          </div>
          <div className="font-mono text-xs tracking-[2px] mt-2 text-zinc-400">POINTS</div>
        </div>

        {/* Game Container */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-center mb-8 leading-none">
            RETRO_SNAKE<br/>X_BEATS
          </h1>
          
          <div 
            ref={containerRef}
            className="w-full max-w-[500px] aspect-square border-[8px] border-white bg-[#111] shadow-[0_0_40px_rgba(255,255,255,0.1)] relative"
          >
            <canvas 
              ref={canvasRef}
              className="w-full h-full block"
            />

            {/* Overlays */}
            {!isGameRunning && !gameOver && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-20">
                <h2 className="text-4xl font-black text-cyan-400 mb-4 drop-shadow-[0_0_10px_rgba(0,243,255,0.8)]">NEON SNAKE</h2>
                <p className="text-fuchsia-500 animate-pulse mt-2 font-mono text-sm">Press any arrow key to start</p>
              </div>
            )}

            {gameOver && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-md z-20">
                <h2 className="text-5xl font-black text-red-500 mb-2 drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]">GAME OVER</h2>
                <p className="text-cyan-400 text-xl mb-6 mt-4 font-mono">Final Score: {score}</p>
                <button 
                  onClick={resetGame}
                  className="px-6 py-3 border-2 border-fuchsia-500 text-fuchsia-500 font-bold hover:bg-fuchsia-500/20 transition-colors rounded font-mono"
                >
                  PLAY AGAIN
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-6 text-center text-zinc-500 font-mono text-xs tracking-widest">
            USE ARROW KEYS OR WASD TO MOVE
          </div>
        </div>

        {/* Player Bar */}
        <div className="border-t border-zinc-800 bg-black/80 backdrop-blur-md p-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 z-20">
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 bg-gradient-to-tr from-cyan-400 to-fuchsia-500 shrink-0"></div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{TRACKS[currentTrack].title.split(' (')[0]}</div>
              <div className="font-mono text-[10px] text-cyan-400 tracking-wider">CURRENTLY PLAYING</div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-cyan-400 transition-colors">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button onClick={togglePlay} className="text-cyan-400 hover:text-cyan-300 transition-colors drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]">
              {isPlaying ? <Pause size={32} /> : <Play size={32} />}
            </button>
            <button onClick={skipTrack} className="text-white hover:text-cyan-400 transition-colors">
              <SkipForward size={20} />
            </button>
          </div>
          
          <div className="w-full md:w-48 flex items-center gap-3">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400"
            />
          </div>
        </div>

      </div>

      <audio 
        ref={audioRef} 
        src={TRACKS[currentTrack].url} 
        onEnded={skipTrack}
        loop={false}
      />
    </div>
  );
}
