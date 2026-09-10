import { UserProfileWireframe } from './components/UserProfileWireframe';
import { mockProfile } from './mockData';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <UserProfileWireframe profile={mockProfile} />
    </div>
  );
}