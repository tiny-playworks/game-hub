import './App.css';
import { Button } from '@/components/ui/button';

const App = () => {
  return (
    <div className="content">
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>
      <div className="mt-6 flex gap-3 justify-center">
        <Button>默认按钮</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  );
};

export default App;
