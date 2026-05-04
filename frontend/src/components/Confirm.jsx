import Modal from './Modal';

export default function Confirm({ title, message, onConfirm, onClose, danger = true }) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-slate-300 text-sm mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose(); }}>
          Confirmer
        </button>
      </div>
    </Modal>
  );
}
