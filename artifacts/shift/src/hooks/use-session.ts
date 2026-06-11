import { useState, useEffect } from 'react';

export function useSession() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let id = sessionStorage.getItem('shift_session_id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('shift_session_id', id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}
