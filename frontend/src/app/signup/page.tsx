"use client";
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import 'react-toastify/dist/ReactToastify.css';
import { appName, serverURL } from '@/utils/utils';
import { ToastContainer, toast } from 'react-toastify';
import VerticalCarousel from './VerticalCarousel';

export default function Home() {
  const [theme, setTheme] = useState<null | any | string>("light");
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [verificationCodeSent, setVerificationCodeSent] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [formStep, setFormStep] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTheme(localStorage.getItem("theme") ? localStorage.getItem("theme") : "light");
      if (localStorage.getItem("token")) {
        window.location.href = "/chat";
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const localTheme: string = localStorage.getItem("theme")!.toString();
    document.querySelector("html")!.setAttribute("data-theme", localTheme);
  }, [theme]);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    try {
      console.log(response);
      
      const tokenId = response.credential;
  
      const config = {
        method: "POST",
        url: `${serverURL}/users/google-auth`,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": `application/json`,
        },
        data: {
          tokenId: tokenId,
        },
      };
  
      const res = await axios(config);
  
      if (res.status === 200) {
        const { token, user } = res.data;
        toast.success("Google Authentication Successful!");
        localStorage.setItem("token", token);
        window.location.href = user.type === "admin" ? "/admin" : "/";
      } else {
        throw new Error("Failed to authenticate with the server");
      }
    } catch (error) {
      console.error("Google authentication error:", error);
      toast.error("Google authentication failed. Please try again.");
    }
  };
  
  const handleGoogleError = () => {
    toast.error("Google Sign-In was unsuccessful. Please try again.");
  };
  
  const sendVerificationCode = async () => {
    setLoading(true);
    if (email === "") {
      toast.error("Please enter your email!");
      setLoading(false);
      return;
    }

    const config = {
      method: "POST",
      url: `${serverURL}/users/send-verification-code`,
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": `application/json`,
      },
      data: {
        "email": email
      }
    };

    axios(config)
      .then((response) => {
        toast.success("Verification Code Sent!");
        setVerificationCodeSent(true);
        setLoading(false);
        setFormStep(2);
      })
      .catch((error) => {
        toast.error("Something went wrong! Please try again later.");
        setLoading(false);
      });
  };

  const verifyEmail = async () => {
    if (name === "" || password === "" || verificationCode === "") {
      toast.error("Please fill out all fields!");
      return;
    }

    const config = {
      method: "POST",
      url: `${serverURL}/users/verify-email`,
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": `application/json`,
      },
      data: {
        "email": email,
        "code": verificationCode,
      }
    };

    axios(config)
      .then((response) => {
        toast.success("Email verified!");
        signup();
      })
      .catch((error) => {
        toast.error("Something went wrong! Please try again later.");
      });
  };

  const signup = async () => {
    const config = {
      method: "POST",
      url: `${serverURL}/users/signup`,
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": `application/json`,
      },
      data: {
        "name": name,
        "email": email,
        "password": password,
      }
    };

    axios(config)
      .then((response) => {
        toast.success("Account created!");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      })
      .catch((error) => {
        toast.error("Something went wrong!");
      });
  };

  return (
    <main className="w-screen h-screen bg-base-100 flex flex-col items-center justify-center p-2 overflow-hidden">
      <div className="absolute top-0 left-0 p-4 mx-4 my-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">NoaiGPTχ</h1>
        </div>
      </div>
      <VerticalCarousel />

      <div className="animate-fade-in-bottom flex flex-col w-full max-w-md rounded-xl p-10 border border-gray-300">
        {formStep === 1 && (
          <>
            <p className="font-bold text-xl mb-4">Enter your personal or work email</p>
            <input
              className="input input-bordered mb-4 w-full"
              placeholder="Enter your email"
              type="text"
              onChange={(x) => setEmail(x.target.value)}
              value={email}
            />
            <button
              className="btn btn-primary w-full mb-4"
              onClick={() => {
                if (loading) return;
                if (!verificationCodeSent) {
                  sendVerificationCode();
                }
              }}
            >
              {loading ? <span className="loading loading-spinner"></span> : "Continue with email"}
            </button>
            
            
            <div className="flex justify-center"> {/* Container to center the Google auth button */}

            <GoogleOAuthProvider clientId="602949390183-3164gj6t7dk9nsir9baenhsbgldhondc.apps.googleusercontent.com">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size='large'
                ux_mode='popup'
                theme="filled_blue"
                shape='pill'
                locale='english'
                text='continue_with'

                
              />
            </GoogleOAuthProvider>
            </div>

          </>
        )}
        {formStep === 2 && (
          <>
            <p className="text-sm mb-1 mt-8">Full Name</p>
            <input
              className="input input-bordered mb-5 w-full"
              placeholder="Full Name"
              type="text"
              onChange={(x) => setName(x.target.value)}
              value={name}
            />
            <button className="btn btn-primary w-full mb-4" onClick={() => setFormStep(3)}>
              Next
            </button>
          </>
        )}
        {formStep === 3 && (
          <>
            <p className="text-sm mb-1">Password</p>
            <input
              className="input input-bordered mb-5 w-full"
              placeholder="Password"
              type="password"
              onChange={(x) => setPassword(x.target.value)}
              value={password}
            />
            <button className="btn btn-primary w-full mb-4" onClick={() => setFormStep(4)}>
              Next
            </button>
          </>
        )}
        {formStep === 4 && (
          <>
            <p className="text-sm mb-1">Verification Code</p>
            <input
              className="input input-bordered mb-5 w-full"
              placeholder="Verification Code"
              type="text"
              onChange={(x) => setVerificationCode(x.target.value)}
              value={verificationCode}
            />
            <button className="btn btn-primary w-full" onClick={() => verifyEmail()}>
              Create Account
            </button>
          </>
        )}
      <p className="mt-8 text-center">
          Have an account?{" "}
          <Link href={"/login"}>
            <span className="link link-primary">Log in</span>
          </Link>
        </p>
      </div>
      <ToastContainer />
    </main>
  );
}