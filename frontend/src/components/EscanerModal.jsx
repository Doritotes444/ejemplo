import BarcodeScanner from './BarcodeScanner'

export default function EscanerModal({ onDetect, onScan, onClose }) {
  const handleScan = (codigo) => {
    if (onDetect) onDetect(codigo)
    if (onScan) onScan(codigo)
  }

  return <BarcodeScanner onScan={handleScan} onClose={onClose} />
}
