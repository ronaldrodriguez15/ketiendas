import { ToastContainer, Slide } from 'react-toastify';
import { CircleCheck, CircleAlert, Info, TriangleAlert } from 'lucide-react';
const icons = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info };
export default function Notifications() {
  return <ToastContainer position="top-right" autoClose={4200} limit={3} newestOnTop
    closeOnClick={false} pauseOnHover pauseOnFocusLoss draggable transition={Slide}
    className="panel-notifications" toastClassName="panel-toast" ariaLabel="Notificaciones del panel"
    icon={({ type }) => { const Icon = icons[type] || Info; return <Icon size={22} strokeWidth={1.8} />; }} />;
}
