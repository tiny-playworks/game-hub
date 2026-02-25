import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from '@/contexts/LocaleContext';
import Category from '@/pages/Category';
import Game2048 from '@/pages/Game2048';
import GameBreakout from '@/pages/GameBreakout';
import GameGomoku from '@/pages/GameGomoku';
import GameGuessNumber from '@/pages/GameGuessNumber';
import GameMahjongChinese from '@/pages/GameMahjongChinese';
import GameMahjongJapanese from '@/pages/GameMahjongJapanese';
import GameMahjongSichuan from '@/pages/GameMahjongSichuan';
import GameMemory from '@/pages/GameMemory';
import GameShooter from '@/pages/GameShooter';
import GameSnake from '@/pages/GameSnake';
import GameTank from '@/pages/GameTank';
import GameTetris from '@/pages/GameTetris';
import GameTictactoe from '@/pages/GameTictactoe';
import Home from '@/pages/Home';
import './App.css';

const App = () => {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/category/:categoryId" element={<Category />} />
          <Route
            path="/game/mahjong-chinese"
            element={<GameMahjongChinese />}
          />
          <Route
            path="/game/mahjong-sichuan"
            element={<GameMahjongSichuan />}
          />
          <Route
            path="/game/mahjong-japanese"
            element={<GameMahjongJapanese />}
          />
          <Route path="/game/guess-number" element={<GameGuessNumber />} />
          <Route path="/game/tictactoe" element={<GameTictactoe />} />
          <Route path="/game/memory" element={<GameMemory />} />
          <Route path="/game/2048" element={<Game2048 />} />
          <Route path="/game/snake" element={<GameSnake />} />
          <Route path="/game/breakout" element={<GameBreakout />} />
          <Route path="/game/shooter" element={<GameShooter />} />
          <Route path="/game/tank" element={<GameTank />} />
          <Route path="/game/tetris" element={<GameTetris />} />
          <Route path="/game/gomoku" element={<GameGomoku />} />
        </Routes>
      </LocaleProvider>
    </BrowserRouter>
  );
};

export default App;
