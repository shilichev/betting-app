import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';
import App from './App';
import './main.css';

registerLocale('ru', ru);

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
