import { createContext, useCallback, useContext, useState, useEffect } from 'react';



const ToastContext = createContext(null);



function ToastIcon({ type }) {

  if (type === 'error') {

    return (

      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

        <circle cx="12" cy="12" r="10" />

        <path d="M12 8v4M12 16h.01" />

      </svg>

    );

  }

  return (

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

      <circle cx="12" cy="12" r="10" />

      <path d="M9 12.75 11.25 15 15 9" />

    </svg>

  );

}



export function ToastProvider({ children }) {

  const [toast, setToast] = useState(null);



  const showToast = useCallback((options) => {

    const { message, type = 'success', actionLabel, onAction, duration: durationOpt } = options || {};

    const duration =

      durationOpt ??

      (actionLabel ? 5200 : type === 'error' ? 4500 : 3200);

    setToast({

      id: Date.now(),

      message,

      type,

      actionLabel,

      onAction,

      duration,

    });

  }, []);



  useEffect(() => {

    if (!toast) return;

    const timer = setTimeout(() => {

      setToast(null);

    }, toast.duration);

    return () => clearTimeout(timer);

  }, [toast]);



  const handleAction = () => {

    if (toast?.onAction) {

      toast.onAction();

    }

    setToast(null);

  };



  const toastClass =

    toast?.type === 'error' ? 'toast-error' : toast?.type === 'success' ? 'toast-success' : 'toast-info';



  return (

    <ToastContext.Provider value={{ showToast }}>

      {children}

      {toast && (

        <div className={`toast-root ${toastClass}`} role="status">

          <div className="toast-icon">

            <ToastIcon type={toast.type} />

          </div>

          <div className="toast-body">

            <div className="toast-message">{toast.message}</div>

          </div>

          {toast.actionLabel && (

            <button type="button" className="toast-action" onClick={handleAction}>

              {toast.actionLabel}

            </button>

          )}

        </div>

      )}

    </ToastContext.Provider>

  );

}



export function useToast() {

  const ctx = useContext(ToastContext);

  if (!ctx) {

    throw new Error('useToast must be used within ToastProvider');

  }

  return ctx;

}


