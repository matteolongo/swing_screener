import React from 'react';
import { Button, Badge } from 'react-bootstrap';

// Removed unused import 'Order'
import { formatDateTime } from './utils';

const Dashboard = () => {
  // Removed unused variable 'actionItems'
  const data = []; // Example data

  return (
    <div>
      <h1>Dashboard</h1>
      <Button variant="primary">Click Me</Button>
      <Badge variant="primary">New</Badge> // Changed Badge variant
    </div>
  );
};

export default Dashboard;