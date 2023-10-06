import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = ({auth}:any) => {
  // const auth = null; // determine if authorized, from context or however you're doing it

  // If authorized, return an outlet that will render child elements
  // If not, return element that will navigate to login page
  return auth ? <Outlet /> : <Navigate to="/home" />;
}

export default PrivateRoute