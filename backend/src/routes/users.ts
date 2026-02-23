import { Router } from "express";
import { store } from "../store.js";
import { ModeAccess, Role } from "../types.js";

export const usersRouter = Router();

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Gebruikers ophalen (optioneel zoeken)
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lijst met users
 */
usersRouter.get("/", (req, res) => {
  const search = String(req.query.search ?? "").trim();
  return res.json(store.listUsers(search));
});

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Active status updaten
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       204: { description: Updated }
 *       404: { description: Not found }
 */
usersRouter.patch("/:id/status", (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body as { isActive: boolean };
  const nextIsActive = Boolean(isActive);

  const user = store.findUserById(id);
  if (!user) return res.status(404).json({ message: "User niet gevonden" });

  if (user.role === Role.ADMIN && user.isActive && !nextIsActive) {
    if (store.countActiveAdmins() <= 1) {
      return res.status(400).json({ message: "Er moet minimaal 1 actieve admin blijven" });
    }
  }

  const updated = store.updateUserStatus(id, nextIsActive);
  if (!updated) return res.status(404).json({ message: "User niet gevonden" });

  return res.status(204).send();
});

/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: Rol updaten
 */
usersRouter.patch("/:id/role", (req, res) => {
  const { id } = req.params;
  const { role } = req.body as { role: Role };

  if (!Object.values(Role).includes(role)) return res.status(400).json({ message: "Ongeldige role" });
  const user = store.findUserById(id);
  if (!user) return res.status(404).json({ message: "User niet gevonden" });

  if (user.role === Role.ADMIN && role !== Role.ADMIN) {
    if (store.countAdmins() <= 1) {
      return res.status(400).json({ message: "Er moet minimaal 1 admin blijven" });
    }
    if (user.isActive && store.countActiveAdmins() <= 1) {
      return res.status(400).json({ message: "Er moet minimaal 1 actieve admin blijven" });
    }
  }

  const updated = store.updateUserRole(id, role);
  if (!updated) return res.status(404).json({ message: "User niet gevonden" });

  return res.status(204).send();
});

/**
 * @openapi
 * /users/{id}/mode:
 *   patch:
 *     tags: [Users]
 *     summary: Mode access updaten
 */
usersRouter.patch("/:id/mode", (req, res) => {
  const { id } = req.params;
  const { modeAccess } = req.body as { modeAccess: ModeAccess };

  if (!Object.values(ModeAccess).includes(modeAccess)) {
    return res.status(400).json({ message: "Ongeldige modeAccess" });
  }

  const updated = store.updateUserMode(id, modeAccess);
  if (!updated) return res.status(404).json({ message: "User niet gevonden" });

  return res.status(204).send();
});

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: User verwijderen
 */
usersRouter.delete("/:id", (req, res) => {
  const { id } = req.params;
  const user = store.findUserById(id);
  if (!user) return res.status(404).json({ message: "User niet gevonden" });

  if (user.role === Role.ADMIN) {
    if (store.countAdmins() <= 1) {
      return res.status(400).json({ message: "Er moet minimaal 1 admin blijven" });
    }
    if (user.isActive && store.countActiveAdmins() <= 1) {
      return res.status(400).json({ message: "Er moet minimaal 1 actieve admin blijven" });
    }
  }

  const deleted = store.deleteUser(id);
  if (!deleted) return res.status(404).json({ message: "User niet gevonden" });
  return res.status(204).send();
});
