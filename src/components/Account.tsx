// src/components/Account.tsx
import { useState } from "react";
import { auth } from "@/lib/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

export default function Account() {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (newPwd !== confirmPwd) {
      setMsg("Confirmação diferente da nova senha.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Usuário não logado.");

      // 1) Reautenticar com a SENHA ATUAL
      const cred = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(user, cred);

      // 2) Atualizar senha para a NOVA
      await updatePassword(user, newPwd);

      setMsg("Senha atualizada com sucesso.");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/wrong-password") setMsg("Senha atual incorreta.");
      else if (code === "auth/weak-password") setMsg("Nova senha muito fraca.");
      else if (code === "auth/too-many-requests") setMsg("Muitas tentativas. Tente mais tarde.");
      else setMsg(err?.message || "Erro ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-xl">
      <input
        type="password"
        placeholder="Senha atual"
        value={currentPwd}
        onChange={(e) => setCurrentPwd(e.target.value)}
        className="border p-2 rounded w-full mb-2"
        required
      />
      <input
        type="password"
        placeholder="Nova senha"
        value={newPwd}
        onChange={(e) => setNewPwd(e.target.value)}
        className="border p-2 rounded w-full mb-2"
        required
      />
      <input
        type="password"
        placeholder="Confirmar nova senha"
        value={confirmPwd}
        onChange={(e) => setConfirmPwd(e.target.value)}
        className="border p-2 rounded w-full mb-2"
        required
      />
      <button type="submit" disabled={loading} className="border px-4 py-2 rounded">
        {loading ? "Salvando..." : "Salvar nova senha"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
