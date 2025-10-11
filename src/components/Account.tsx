// src/components/Account.tsx
// Atualizado: remove dependência de markMustChange (modo teste)
// Faz apenas reautenticação + updatePassword

import React, { useState } from "react";
import { auth } from "../lib/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

const Account: React.FC = () => {
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

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Usuário não logado.");

      const cred = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(user, cred);
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
      else if (code === "auth/requires-recent-login") setMsg("Faça login novamente e tente de novo.");
      else setMsg(err?.message || "Erro ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-4">Minha conta</h1>
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-medium mb-2">Alterar senha</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Senha atual"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />
          <input
            type="password"
            placeholder="Nova senha"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </div>
    </div>
  );
};

export default Account;
