import React, { useState } from 'react';
import { verifyDualRepoStructure } from '../utils/verify-setup';
import { runFunctionalTest } from '../utils/functional-test';

export default function VerificationPage() {
    const [structureResult, setStructureResult] = useState(null);
    const [functionalResult, setFunctionalResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const runVerification = async () => {
        setLoading(true);
        try {
            const sResult = await verifyDualRepoStructure();
            setStructureResult(sResult);

            const fResult = await runFunctionalTest();
            setFunctionalResult(fResult);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-gray-900 min-h-screen text-white">
            <h1 className="text-3xl font-bold mb-6">Verification Suite</h1>

            <button
                id="run-verification-btn"
                onClick={runVerification}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Running...' : 'Run Verification'}
            </button>

            <div className="mt-8 grid grid-cols-2 gap-8">
                <div className="bg-gray-800 p-4 rounded">
                    <h2 className="text-xl font-bold mb-4">Structure Verification</h2>
                    <pre id="structure-result" className="whitespace-pre-wrap text-sm font-mono">
                        {structureResult ? JSON.stringify(structureResult, null, 2) : 'Not run yet'}
                    </pre>
                </div>

                <div className="bg-gray-800 p-4 rounded">
                    <h2 className="text-xl font-bold mb-4">Functional Test</h2>
                    <pre id="functional-result" className="whitespace-pre-wrap text-sm font-mono">
                        {functionalResult ? JSON.stringify(functionalResult, null, 2) : 'Not run yet'}
                    </pre>
                </div>
            </div>
        </div>
    );
}
