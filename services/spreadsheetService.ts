
export interface SpreadsheetRow {
  index: string;
  fileName: string; // Este será o "NUMERO" para dar match com o arquivo
  caption: string;  // Este será o "TITULO"
  comment: string;  // Este será o "LINK DO COMENTARIO"
  scheduledDate: string; // Este será o "DATA" + "HORA"
  status: 'pending' | 'ready' | 'missing_file';
}

export const fetchGoogleSheetData = async (url: string): Promise<SpreadsheetRow[]> => {
  try {
    const sheetIdMatch = url.match(/\/d\/(.*?)(\/|$)/);
    if (!sheetIdMatch) throw new Error("Link da planilha inválido.");
    
    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    
    // Parse considerando vírgula ou ponto e vírgula comum em CSVs brasileiros
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    const rows: SpreadsheetRow[] = [];
    
    // Pula o cabeçalho (Linha 1: NUMERO, CAMINHO, TITULO, LINK, DATA, HORA)
    for (let i = 1; i < lines.length; i++) {
      // Split que respeita aspas e lida com ponto e vírgula ou vírgula
      const delimiter = csvText.includes(';') ? ';' : ',';
      const columns = lines[i].split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`));
      
      if (columns.length >= 5) {
        const numero = columns[0]?.replace(/"/g, '').trim() || "";
        const dataStr = columns[4]?.replace(/"/g, '').trim() || "";
        const horaStr = columns[5]?.replace(/"/g, '').trim() || "00:00";
        
        // Converter DD/MM/YYYY HH:MM para um formato que o JS entenda
        let finalDate = "";
        if (dataStr) {
          const parts = dataStr.split('/');
          if (parts.length === 3) {
            // Formato YYYY-MM-DDTHH:MM:00
            finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${horaStr}:00`;
          }
        }

        rows.push({
          index: numero,
          fileName: numero, // Usamos o número para casar com o arquivo enviado
          caption: columns[2]?.replace(/"/g, '').trim() || "", // TITULO
          comment: columns[3]?.replace(/"/g, '').trim() || "", // LINK DO COMENTARIO
          scheduledDate: finalDate, 
          status: 'pending'
        });
      }
    }
    
    return rows;
  } catch (e: any) {
    throw new Error(`Erro ao ler planilha: ${e.message}`);
  }
};
