import { usersService } from './users.service.js';
import { updateUserSchema, userQuerySchema } from './users.types.js';
import { sendSuccess } from '../../utils/response.js';
/**
 * @swagger
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
export async function getMe(req, res, next) {
    try {
        const user = await usersService.findById(req.user.userId);
        sendSuccess(res, user);
    }
    catch (error) {
        next(error);
    }
}
/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Update current user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Updated user profile
 */
export async function updateMe(req, res, next) {
    try {
        const input = updateUserSchema.parse(req.body);
        const user = await usersService.update(req.user.userId, input);
        sendSuccess(res, user, 'Profile updated successfully');
    }
    catch (error) {
        next(error);
    }
}
/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of users
 */
export async function getUsers(req, res, next) {
    try {
        const query = userQuerySchema.parse(req.query);
        const result = await usersService.findAll(query);
        sendSuccess(res, result);
    }
    catch (error) {
        next(error);
    }
}
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 */
export async function getUserById(req, res, next) {
    try {
        const user = await usersService.findById(req.params.id);
        sendSuccess(res, user);
    }
    catch (error) {
        next(error);
    }
}
/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update user by ID (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *               status:
 *                 type: string
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user
 */
export async function updateUserById(req, res, next) {
    try {
        const input = updateUserSchema.parse(req.body);
        const user = await usersService.update(req.params.id, input);
        sendSuccess(res, user, 'User updated successfully');
    }
    catch (error) {
        next(error);
    }
}
/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user by ID (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 */
export async function deleteUserById(req, res, next) {
    try {
        await usersService.delete(req.params.id);
        sendSuccess(res, null, 'User deleted successfully');
    }
    catch (error) {
        next(error);
    }
}
/**
 * @swagger
 * /api/users/public/doctors:
 *   get:
 *     tags: [Users]
 *     summary: Get all active doctors (Public)
 *     responses:
 *       200:
 *         description: List of active doctors
 */
export async function getPublicDoctors(req, res, next) {
    try {
        const doctors = await usersService.findActiveDoctors();
        sendSuccess(res, doctors);
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=users.controller.js.map