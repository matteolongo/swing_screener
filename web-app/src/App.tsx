import TabBar from './components/layout/TabBar';
import Layout from './components/layout/Layout';
import AlertStrip from './components/layout/AlertStrip';

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <AlertStrip />
      <TabBar />
      <Layout />
    </div>
  );
}
