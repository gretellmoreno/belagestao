// Este arquivo contém apenas a parte final do arquivo AppointmentForm.tsx
// Você deve substituir o final do seu arquivo por este conteúdo

// Verificar onde está o erro da chave extra no final do arquivo.
// Normalmente deve ter algo como:

// ... resto do seu código ...

function highlightMatch(text: string, query: string): JSX.Element {
  if (!query.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${query.trim()})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-indigo-100 text-indigo-800 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function isValidDate(dateString: string): boolean {
  try {
    const date = parseISO(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  } catch {
    return false;
  }
} 