import DashboardClient from '../components/DashboardClient';
import { getDashboardData } from '../lib/data';

export default function Page() {
  const payload = getDashboardData();
  return <DashboardClient payload={payload} />;
}
