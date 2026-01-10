import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  portalApi,
  setPortalSessionToken,
  setPortalWorkspaceId,
} from "../../lib/portal-api";

export function PortalVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);

  const token = searchParams.get("token");
  const workspaceId = searchParams.get("workspace");

  useEffect(() => {
    const verify = async () => {
      if (!token || !workspaceId) {
        setError("Invalid or missing link parameters");
        setIsVerifying(false);
        return;
      }

      try {
        const result = await portalApi.verifyMagicLink(token, workspaceId);
        setPortalSessionToken(result.sessionToken);
        setPortalWorkspaceId(workspaceId);
        navigate("/portal", { replace: true });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to verify link. It may have expired.",
        );
        setIsVerifying(false);
      }
    };

    verify();
  }, [token, workspaceId, navigate]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="animate-spin mx-auto h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
              <p className="mt-4 text-sm text-gray-500">
                Signing you in...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">
              Link expired or invalid
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {error || "The login link is no longer valid."}
            </p>
            <button
              onClick={() =>
                navigate(
                  workspaceId
                    ? `/portal/login?workspace=${workspaceId}`
                    : "/portal/login",
                )
              }
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Request new link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
