import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';
import GameBreakout from '@/pages/GameBreakout';
import './App.css';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/breakout" element={<GameBreakout />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
