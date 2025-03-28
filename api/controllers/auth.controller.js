import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {User,Student,Admin,Faculty} from '../models/user.model.js';
import { validateAccessToken, validateRefreshToken } from '../middleware/auth.middleware.js';
import { findUserByEmail, verifyRefreshTokenInDB } from '../middleware/auth.middleware.js';

export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Validate input (can be moved to a separate middleware if needed)
        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Email, password, and role are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        let specificUser;
        switch (role) {
            case 'student':
                specificUser = await Student.findOne({ email: email.toLowerCase().trim() }); // Assuming Student model is defined
                break;
            case 'admin':
                specificUser = await Admin.findOne({ email: email.toLowerCase().trim() });     // Assuming Admin model is defined
                break;
            case 'faculty':
                specificUser = await Faculty.findOne({ email: email.toLowerCase().trim() });   // Assuming Faculty model is defined
                break;
            default:
                return res.status(400).json({ message: 'Invalid role' });
        }

        if (!specificUser) {
            return res.status(401).json({ message: 'Invalid role' });
        }

        const accessToken = jwt.sign({ user: { email: user.email, role: role } }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ user: { email: user.email, role: role } }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });

        // Save refresh token to the database
        user.refreshToken = refreshToken;
        await user.save();

        return res.status(200)
            .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
            .header('Authorization', accessToken)
            .json({ user: { email: user.email, role: role } });

    } catch (err) {
        console.error("Error during login:", err);
        return res.status(500).send("Something went wrong!");
    }
};

export const refresh = [
    validateRefreshToken,
    findUserByEmail,
    verifyRefreshTokenInDB,
    async (req, res) => {
        try {
            const accessToken = jwt.sign({ user: { email: req.foundUser.email, role: req.foundUser.role } }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            return res.status(200)
                .header('Authorization', accessToken)
                .json({ user: { email: req.foundUser.email, role: req.foundUser.role } });
        } catch (error) {
            console.error("Error during refresh:", error);
            return res.status(500).send("Internal server error");
        }
    }
];

export const logout = [
    validateAccessToken,
    async (req, res) => {
        try {
            const user = await User.findOne({ email: req.user.email }); // User info from validateAccessToken

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.refreshToken = null;
            await user.save();

            res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });
            return res.status(200).json({ message: "Logout successful" });

        } catch (error) {
            console.error("Error during logout:", error);
            return res.status(500).send("Something went wrong!");
        }
    }
];