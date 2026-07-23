import CrmApp from '../components/CrmApp';
import { getDashboardData } from '../lib/data';

export default function Page() {
  const payload = getDashboardData();
  return <CrmApp payload={payload} />;
}
