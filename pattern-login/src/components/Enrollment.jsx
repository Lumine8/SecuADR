import React, { useState } from 'react';
import PatternCanvas from './PatternCanvas';
import AuthService from '../services/auth.js';
import './Enrollment.css';

const ENROLLMENT_STEPS = {
    USERNAME: 'username',
    GESTURE: 'gesture',
    BASELINE: 'baseline',
    CONFIRMED: 'confirmed',
    COMPLETE: 'complete',
};

const SAMPLE_GESTURES = 3; // Number of baseline samples needed

const Enrollment = ({ onEnrollmentComplete }) => {
    const [step, setStep] = useState(ENROLLMENT_STEPS.USERNAME);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [gestureSequence, setGestureSequence] = useState([]);
    const [baselineSamples, setBaselineSamples] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleUsernameSubmit = (e) => {
        e.preventDefault();
        if (!username.trim() || !email.trim()) {
            setError('Please enter both username and email');
            return;
        }
        setError('');
        setStep(ENROLLMENT_STEPS.GESTURE);
        setMessage('Draw your gesture pattern. This will be your unique biometric template.');
    };

    const handleGestureCapture = (points) => {
        setGestureSequence(points);
        setMessage(`Gesture captured! Points: ${points.length}`);
    };

    const handleGestureConfirm = async () => {
        if (gestureSequence.length < 20) {
            setError('Gesture too short. Please draw a longer pattern.');
            return;
        }

        setMessage('Processing gesture...');
        setLoading(true);
        setError('');

        const sample = {
            timestamp: Date.now(),
            points: gestureSequence,
            duration: 1000, // Placeholder
        };

        const newBaseline = [...baselineSamples, sample];
        setBaselineSamples(newBaseline);

        if (newBaseline.length < SAMPLE_GESTURES) {
            setGestureSequence([]);
            setMessage(`Baseline sample ${newBaseline.length}/${SAMPLE_GESTURES} captured. Draw your pattern again.`);
            setLoading(false);
            return;
        }

        // All baseline samples collected, proceed to confirmation
        setLoading(false);
        setMessage('');
        setStep(ENROLLMENT_STEPS.BASELINE);
    };

    const handleConfirmEnrollment = async () => {
        setLoading(true);
        setError('');
        setMessage('Enrolling user with SFAM service...');

        const enrollmentData = {
            username,
            email,
            baselineSamples,
        };

        const response = await AuthService.enrollUser(enrollmentData);

        if (response.success) {
            setMessage('✅ Enrollment successful!');
            setStep(ENROLLMENT_STEPS.COMPLETE);
            setTimeout(() => {
                if (onEnrollmentComplete) {
                    onEnrollmentComplete(username);
                }
            }, 2000);
        } else {
            setError(response.error || 'Enrollment failed. Please try again.');
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setStep(ENROLLMENT_STEPS.USERNAME);
        setUsername('');
        setEmail('');
        setGestureSequence([]);
        setBaselineSamples([]);
        setError('');
        setMessage('');
    };

    return (
        <div className="enrollment-container">
            <div className="enrollment-card">
                <h1>📋 SecuADR Enrollment</h1>
                <p className="enrollment-subtitle">Create your biometric profile for secure, passwordless authentication</p>

                {/* Progress Indicator */}
                <div className="progress-tracker">
                    <div className={`progress-step ${step === ENROLLMENT_STEPS.USERNAME ? 'active' : step !== ENROLLMENT_STEPS.USERNAME ? 'completed' : ''}`}>
                        <div className="progress-circle">1</div>
                        <p>Account Info</p>
                    </div>
                    <div className={`progress-line ${step !== ENROLLMENT_STEPS.USERNAME ? 'active' : ''}`}></div>
                    <div className={`progress-step ${step === ENROLLMENT_STEPS.GESTURE ? 'active' : step !== ENROLLMENT_STEPS.USERNAME && step !== ENROLLMENT_STEPS.GESTURE ? 'completed' : ''}`}>
                        <div className="progress-circle">2</div>
                        <p>Gesture Samples</p>
                    </div>
                    <div className={`progress-line ${step !== ENROLLMENT_STEPS.USERNAME && step !== ENROLLMENT_STEPS.GESTURE ? 'active' : ''}`}></div>
                    <div className={`progress-step ${step === ENROLLMENT_STEPS.BASELINE ? 'active' : step === ENROLLMENT_STEPS.COMPLETE ? 'completed' : ''}`}>
                        <div className="progress-circle">3</div>
                        <p>Review & Confirm</p>
                    </div>
                </div>

                {/* Step 1: Username */}
                {step === ENROLLMENT_STEPS.USERNAME && (
                    <div className="step-content">
                        <h2>Create Your Account</h2>
                        <form onSubmit={handleUsernameSubmit}>
                            <div className="form-group">
                                <label>Username:</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Choose a username"
                                    disabled={loading}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Email:</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    disabled={loading}
                                    required
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary">
                                {loading ? 'Processing...' : 'Continue to Gesture Setup'}
                            </button>
                        </form>

                        <div className="enrollment-info">
                            <h4>Why these details?</h4>
                            <p>Your username identifies your account, while your email enables account recovery.</p>
                        </div>
                    </div>
                )}

                {/* Step 2: Gesture Samples */}
                {step === ENROLLMENT_STEPS.GESTURE && (
                    <div className="step-content">
                        <h2>Draw Your Gesture Pattern</h2>
                        <p className="sample-counter">
                            Sample {baselineSamples.length + 1} of {SAMPLE_GESTURES}
                        </p>

                        <div className="gesture-canvas-wrapper">
                            <PatternCanvas onPatternCapture={handleGestureCapture} readOnly={loading} />
                        </div>

                        <p className="gesture-instructions">
                            Draw a unique gesture. Try to be consistent but natural. You'll repeat this {SAMPLE_GESTURES} times.
                        </p>

                        <div className="button-group">
                            <button
                                onClick={handleGestureConfirm}
                                disabled={loading || gestureSequence.length < 20}
                                className="btn-primary"
                            >
                                {loading ? 'Processing...' : `Confirm Sample ${baselineSamples.length + 1}`}
                            </button>
                            <button onClick={handleCancel} disabled={loading} className="btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Review */}
                {step === ENROLLMENT_STEPS.BASELINE && (
                    <div className="step-content">
                        <h2>Review Your Profile</h2>

                        <div className="review-section">
                            <h3>👤 Account Information</h3>
                            <p><strong>Username:</strong> {username}</p>
                            <p><strong>Email:</strong> {email}</p>
                        </div>

                        <div className="review-section">
                            <h3>🎨 Gesture Baseline</h3>
                            <p><strong>Samples Collected:</strong> {baselineSamples.length}/{SAMPLE_GESTURES}</p>
                            {baselineSamples.map((sample, idx) => (
                                <div key={idx} className="sample-badge">
                                    <span>Sample {idx + 1}</span>
                                    <span className="sample-points">{sample.points.length} points</span>
                                </div>
                            ))}
                        </div>

                        <div className="enrollment-warning">
                            <h4>⚠️ Important</h4>
                            <ul>
                                <li>Your gesture becomes your unique biometric signature</li>
                                <li>Future logins will compare your gesture to this baseline</li>
                                <li>You can update your profile if behavior changes (learning new languages, injuries, etc.)</li>
                                <li>Never share your gesture pattern with others</li>
                            </ul>
                        </div>

                        <div className="button-group">
                            <button
                                onClick={handleConfirmEnrollment}
                                disabled={loading}
                                className="btn-primary btn-large"
                            >
                                {loading ? 'Enrolling...' : '✓ Complete Enrollment'}
                            </button>
                            <button onClick={handleCancel} disabled={loading} className="btn-secondary">
                                Back
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Complete */}
                {step === ENROLLMENT_STEPS.COMPLETE && (
                    <div className="step-content success">
                        <div className="success-icon">✅</div>
                        <h2>Enrollment Complete!</h2>
                        <p>Welcome to SecuADR, <strong>{username}</strong>!</p>
                        <p>Your biometric profile is now ready. You can log in using your gesture pattern.</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="alert alert-error">
                        <strong>❌ Error:</strong> {error}
                    </div>
                )}

                {/* Status Message */}
                {message && !error && (
                    <div className="alert alert-info">
                        <strong>ℹ️</strong> {message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Enrollment;
