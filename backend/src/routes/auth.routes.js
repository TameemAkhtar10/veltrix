import { Router } from 'express';
import { userregister, verifyemail, userlogin, getme, userlogout } from '../controller/auth.controller.js';
import { registerValidator, loginvalidator } from '../validator/auth.validator.js';
import { authUser } from '../middleware/auth.middleware.js';
let authRouter = Router();

authRouter.post('/register', registerValidator, userregister);
authRouter.post('/login', loginvalidator, userlogin);
authRouter.post('/logout', authUser, userlogout)
authRouter.get('/get-me', authUser, getme)
authRouter.get('/verify-email', verifyemail);

export default authRouter;