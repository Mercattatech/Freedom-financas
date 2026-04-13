/**
 * pages.config.js - Page routing configuration
 */
import Admin from './pages/Admin';
import AdminPlans from './pages/AdminPlans';
import AdminSubscribers from './pages/AdminSubscribers';
import Budget from './pages/Budget';
import Categories from './pages/Categories';
import CheckoutSuccess from './pages/CheckoutSuccess';
import Dashboard from './pages/Dashboard';
import Debts from './pages/Debts';
import Families from './pages/Families';
import InvestmentBoxes from './pages/InvestmentBoxes';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Pricing from './pages/Pricing';
import ResetPassword from './pages/ResetPassword';
import Stocks from './pages/Stocks';
import Transactions from './pages/Transactions';
import Wealth from './pages/Wealth';
import Obrigado from './pages/Obrigado';
import Evolution from './pages/Evolution';
import Goals from './pages/Goals';
import HelpCenter from './pages/HelpCenter';
import CreditCards from './pages/CreditCards';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "AdminPlans": AdminPlans,
    "AdminSubscribers": AdminSubscribers,
    "Budget": Budget,
    "Categories": Categories,
    "CheckoutSuccess": CheckoutSuccess,
    "Dashboard": Dashboard,
    "Debts": Debts,
    "Families": Families,
    "InvestmentBoxes": InvestmentBoxes,
    "LandingPage": LandingPage,
    "Login": Login,
    "Pricing": Pricing,
    "ResetPassword": ResetPassword,
    "Stocks": Stocks,
    "Transactions": Transactions,
    "Wealth": Wealth,
    "Obrigado": Obrigado,
    "Evolution": Evolution,
    "Goals": Goals,
    "HelpCenter": HelpCenter,
    "CreditCards": CreditCards,
}

// Pages that don't require authentication
export const PUBLIC_PAGES = ['LandingPage', 'Login', 'Obrigado', 'Pricing', 'CheckoutSuccess', 'ResetPassword'];

export const pagesConfig = {
    mainPage: "LandingPage",
    Pages: PAGES,
    Layout: __Layout,
};