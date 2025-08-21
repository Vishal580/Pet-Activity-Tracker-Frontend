import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Heart, MessageCircle, AlertTriangle, Zap, Loader2 } from 'lucide-react';

// API Configuration - Updated for proper environment detection
const API_BASE_URL = process.env.NODE_ENV === "production"
    ? "https://pet-tracker-backend-f1wx.onrender.com"
    : "http://localhost:5000";

// API Service Functions - Fixed with /api prefix
const apiService = {
  // Get all activities and current pet
  async getActivities() {
    const response = await fetch(`${API_BASE_URL}/api/activities`);
    if (!response.ok) throw new Error('Failed to fetch activities');
    return await response.json();
  },

  // Add new activity
  async addActivity(activityData) {
    const response = await fetch(`${API_BASE_URL}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add activity');
    }
    return await response.json();
  },

  // Get today's summary
  async getSummary() {
    const response = await fetch(`${API_BASE_URL}/api/summary`);
    if (!response.ok) throw new Error('Failed to fetch summary');
    return await response.json();
  },

  // Check walk reminder
  async getReminder() {
    const response = await fetch(`${API_BASE_URL}/api/reminder`);
    if (!response.ok) throw new Error('Failed to check reminder');
    return await response.json();
  },

  // Send chat message
  async sendChatMessage(message) {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return await response.json();
  },

  // Get chat history
  async getChatHistory() {
    const response = await fetch(`${API_BASE_URL}/api/chat`);
    if (!response.ok) throw new Error('Failed to fetch chat history');
    return await response.json();
  },

  // Delete activity
  async deleteActivity(id) {
    const response = await fetch(`${API_BASE_URL}/api/activities/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete activity');
    return await response.json();
  }
};

const PetActivityTracker = () => {
  // Core state
  const [petData, setPetData] = useState({
    activities: [],
    currentPet: ''
  });
  const [summary, setSummary] = useState({
    walks: 0,
    meals: 0,
    medications: 0
  });

  // Form state
  const [formData, setFormData] = useState({
    petName: '',
    activityType: 'walk',
    duration: '',
    dateTime: new Date().toISOString().slice(0, 16)
  });
  const [formErrors, setFormErrors] = useState({});

  // UI state
  const [showReminder, setShowReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState({
    activities: false,
    form: false,
    chat: false,
    summary: false
  });
  const [error, setError] = useState('');

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, activities: true, summary: true }));
      setError(''); // Clear any previous errors
      
      // Load activities and summary in parallel
      const [activitiesResult, summaryResult] = await Promise.all([
        apiService.getActivities(),
        apiService.getSummary()
      ]);
      
      setPetData(activitiesResult.data);
      setSummary(summaryResult.data);
      
      // Load chat history
      const chatResult = await apiService.getChatHistory();
      setChatMessages(chatResult.data);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to connect to server. Please ensure the backend is running on ${API_BASE_URL}`);
    } finally {
      setLoading(prev => ({ ...prev, activities: false, summary: false }));
    }
  }, []);

  // Check for walk reminder
  const checkReminder = useCallback(async () => {
    try {
      const result = await apiService.getReminder();
      setShowReminder(result.data.showReminder);
      setReminderMessage(result.data.message);
    } catch (err) {
      console.error('Error checking reminder:', err);
      // Don't show error for reminder check failures
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check reminder every minute
  useEffect(() => {
    checkReminder();
    const interval = setInterval(checkReminder, 60000);
    return () => clearInterval(interval);
  }, [checkReminder]);

  // Form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.petName.trim()) {
      errors.petName = 'Pet name is required';
    }
    
    if (!formData.duration || parseFloat(formData.duration) <= 0) {
      errors.duration = formData.activityType === 'meal' ? 'Quantity must be greater than 0' : 'Duration must be greater than 0';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(prev => ({ ...prev, form: true }));
      setError('');
      
      await apiService.addActivity({
        petName: formData.petName.trim(),
        activityType: formData.activityType,
        duration: parseFloat(formData.duration),
        dateTime: formData.dateTime
      });
      
      // Reset form
      setFormData({
        petName: formData.petName, // Keep pet name for convenience
        activityType: 'walk',
        duration: '',
        dateTime: new Date().toISOString().slice(0, 16)
      });
      setFormErrors({});
      
      // Reload data
      await loadData();
      await checkReminder();
      
    } catch (err) {
      console.error('Error adding activity:', err);
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, form: false }));
    }
  };

  // Handle chat
  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    try {
      setLoading(prev => ({ ...prev, chat: true }));
      const result = await apiService.sendChatMessage(chatInput);
      
      setChatMessages(prev => [...prev, result.data.userMessage, result.data.aiMessage]);
      setChatInput('');
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, chat: false }));
    }
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className={`flex items-center space-x-2 text-xs ${error ? 'text-red-500' : 'text-green-500'}`}>
      <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'} ${!error ? 'animate-pulse' : ''}`} />
      <span>{error ? 'Disconnected' : 'Connected to server'}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-md mx-auto bg-white shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Heart className="w-6 h-6" />
              <h1 className="text-xl font-bold">Pet Tracker</h1>
            </div>
            <button
              onClick={() => setShowChat(!showChat)}
              className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              disabled={loading.chat}
            >
              {loading.chat ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            {petData.currentPet && (
              <p className="text-purple-100">Tracking {petData.currentPet}</p>
            )}
            <ConnectionStatus />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 p-4 m-4 rounded">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => {
                setError('');
                loadData();
              }}
              className="text-red-600 underline text-sm mt-1"
            >
              Retry connection
            </button>
          </div>
        )}

        {/* Walk Reminder */}
        {showReminder && (
          <div className="bg-orange-100 border-l-4 border-orange-500 p-4 m-4 rounded">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
              <p className="text-orange-800">{reminderMessage}</p>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        {showChat && (
          <div className="border-b bg-gray-50">
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Pet Care Assistant</h3>
              <div className="h-40 overflow-y-auto bg-white rounded-lg p-3 mb-3 space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-500 text-sm">Ask me about your pet's care routine!</p>
                ) : (
                  chatMessages.map(message => (
                    <div key={message.id} className={`text-sm ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block p-2 rounded-lg max-w-xs ${
                        message.type === 'user' 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-gray-200 text-gray-800'
                      }`}>
                        {message.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleChatSubmit)}
                  placeholder="Ask about pet care..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading.chat}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={loading.chat || !chatInput.trim()}
                  className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.chat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Activity Form */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Log Activity</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pet Name
              </label>
              <input
                type="text"
                value={formData.petName}
                onChange={(e) => setFormData(prev => ({ ...prev, petName: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  formErrors.petName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your pet's name"
                disabled={loading.form}
              />
              {formErrors.petName && (
                <p className="text-red-500 text-sm mt-1">{formErrors.petName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type
              </label>
              <select
                value={formData.activityType}
                onChange={(e) => setFormData(prev => ({ ...prev, activityType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={loading.form}
              >
                <option value="walk">Walk</option>
                <option value="meal">Meal</option>
                <option value="medication">Medication</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.activityType === 'walk' ? 'Duration (minutes)' : 
                 formData.activityType === 'meal' ? 'Quantity' : 'Dosage'}
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  formErrors.duration ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={formData.activityType === 'walk' ? '30' : '1'}
                min="0.1"
                step="0.1"
                disabled={loading.form}
              />
              {formErrors.duration && (
                <p className="text-red-500 text-sm mt-1">{formErrors.duration}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.dateTime}
                onChange={(e) => setFormData(prev => ({ ...prev, dateTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={loading.form}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading.form}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 font-medium transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading.form ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging...</span>
                </div>
              ) : (
                'Log Activity'
              )}
            </button>
          </div>

          {/* Today's Summary */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Today's Summary
              {loading.summary && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            </h2>
            
            <div className="space-y-3">
              {/* Walk Progress */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Walk Time</span>
                <span className="font-semibold">{summary.walks} min</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min((summary.walks / 60) * 100, 100)}%` }}
                />
              </div>
              
              {/* Meals & Medication Badges */}
              <div className="flex space-x-4 mt-4">
                <div className="flex items-center bg-white rounded-full px-3 py-1 shadow-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
                  <span className="text-sm">
                    {summary.meals} meal{summary.meals !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex items-center bg-white rounded-full px-3 py-1 shadow-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse" />
                  <span className="text-sm">
                    {summary.medications} med{summary.medications !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Ring Visual */}
            <div className="flex justify-center mt-4">
              <div className="relative w-20 h-20">
                <svg className="transform -rotate-90 w-20 h-20">
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="#e5e7eb"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="url(#gradient)"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.min(summary.walks / 60, 1))}`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          {petData.activities.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Recent Activities
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {loading.activities ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : (
                  petData.activities
                    .slice()
                    .reverse()
                    .slice(0, 5)
                    .map((activity) => (
                      <div key={activity.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium capitalize">{activity.type}</span>
                            <span className="text-gray-600 ml-2">
                              ({activity.duration} {activity.type === 'walk' ? 'min' : activity.type === 'meal' ? 'portion' : 'dose'})
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(activity.dateTime).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{activity.petName}</p>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PetActivityTracker;