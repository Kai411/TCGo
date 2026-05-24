import {
  getAuth,
  PhoneAuthProvider,
  linkWithCredential,
  RecaptchaVerifier,
  type ConfirmationResult,
} from "firebase/auth";

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

const clearRecaptcha = () => {
  try { recaptchaVerifier?.clear(); } catch {}
  recaptchaVerifier = null;
};

export const usePhoneVerification = () => {
  const { app } = useFirebase();
  const { user } = useAuth();
  const { updateProfile } = useMyProfile();

  const sending = ref(false);
  const verifying = ref(false);
  const error = ref("");
  const codeSent = ref(false);

  const initRecaptcha = (buttonId: string) => {
    const auth = getAuth(app!);
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
        size: "invisible",
      });
    }
  };

  const sendCode = async (phoneNumber: string, buttonId: string) => {
    if (!user.value) throw new Error("Not authenticated");

    sending.value = true;
    error.value = "";

    try {
      const auth = getAuth(app!);
      initRecaptcha(buttonId);

      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(
        phoneNumber,
        recaptchaVerifier!,
      );

      confirmationResult = {
        verificationId,
        confirm: async (code: string) => {
          const credential = PhoneAuthProvider.credential(verificationId, code);
          return await linkWithCredential(user.value!, credential);
        },
      } as any;

      codeSent.value = true;
    } catch (e: any) {
      if (e.code === "auth/provider-already-linked") {
        await updateProfile({ whatsappVerified: true, whatsappNumber: phoneNumber });
        codeSent.value = false;
        error.value = "";
        clearRecaptcha();
        return "already-verified";
      }
      error.value = getErrorMessage(e);
      clearRecaptcha();
    } finally {
      sending.value = false;
    }
  };

  const verifyCode = async (code: string, phoneNumber: string): Promise<boolean> => {
    if (!confirmationResult) {
      error.value = "No verification in progress. Please send a code first.";
      return false;
    }

    verifying.value = true;
    error.value = "";

    try {
      await confirmationResult.confirm(code);
      await updateProfile({ whatsappNumber: phoneNumber, whatsappVerified: true });
      confirmationResult = null;
      clearRecaptcha();
      return true;
    } catch (e: any) {
      if (e.code === "auth/invalid-verification-code") {
        error.value = "Incorrect code — double-check and try again.";
      } else if (e.code === "auth/code-expired") {
        error.value = "Code has expired. Please request a new one.";
        codeSent.value = false;
      } else if (e.code === "auth/provider-already-linked") {
        await updateProfile({ whatsappVerified: true, whatsappNumber: phoneNumber });
        return true;
      } else {
        error.value = getErrorMessage(e);
      }
      return false;
    } finally {
      verifying.value = false;
    }
  };

  const reset = () => {
    codeSent.value = false;
    error.value = "";
    confirmationResult = null;
    clearRecaptcha();
  };

  return { sendCode, verifyCode, reset, sending, verifying, error, codeSent };
};

function getErrorMessage(e: any): string {
  const code: string = e?.code ?? "";
  switch (code) {
    case "auth/invalid-phone-number":
      return "Invalid phone number. Use format: +60123456789";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded. Please try again tomorrow.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA check failed. Please try again.";
    case "auth/provider-already-linked":
      return "This phone is already linked to your account.";
    case "auth/credential-already-in-use":
      return "This phone number is already registered to another account.";
    case "auth/billing-not-enabled":
      return "SMS is not enabled on this project. Please contact the administrator.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return e?.message
        ? `Verification failed: ${e.message}`
        : "Verification failed. Please refresh the page and try again.";
  }
}
