import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';
import Category from '@/pages/Category';
import GameBreakout from '@/pages/GameBreakout';
import GameGuessNumber from '@/pages/GameGuessNumber';
import GameTictactoe from '@/pages/GameTictactoe';
import GameMemory from '@/pages/GameMemory';
import Game2048 from '@/pages/Game2048';
import GameSnake from '@/pages/GameSnake';
import GameShooter from '@/pages/GameShooter';
import GameTank from '@/pages/GameTank';
import GameTetris from '@/pages/GameTetris';
import GameMahjongChinese from '@/pages/GameMahjongChinese';
import GameMahjongComingSoon from '@/pages/GameMahjongComingSoon';
import './App.css';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/:categoryId" element={<Category />} />
        <Route path="/game/mahjong-chinese" element={<GameMahjongChinese />} />
        <Route path="/game/mahjong-sichuan" element={<GameMahjongComingSoon />} />
        <Route path="/game/mahjong-japanese" element={<GameMahjongComingSoon />} />
        <Route path="/game/guess-number" element={<GameGuessNumber />} />
        <Route path="/game/tictactoe" element={<GameTictactoe />} />
        <Route path="/game/memory" element={<GameMemory />} />
        <Route path="/game/2048" element={<Game2048 />} />
        <Route path="/game/snake" element={<GameSnake />} />
        <Route path="/game/breakout" element={<GameBreakout />} />
        <Route path="/game/shooter" element={<GameShooter />} />
        <Route path="/game/tank" element={<GameTank />} />
        <Route path="/game/tetris" element={<GameTetris />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
