// Web Worker for handling data loading and processing
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'loadAssignments':
            // Process assignments data
            const assignments = processAssignments(data);
            self.postMessage({ type: 'assignmentsLoaded', data: assignments });
            break;
            
        case 'loadSubmissions':
            // Process submissions data
            const submissions = processSubmissions(data);
            self.postMessage({ type: 'submissionsLoaded', data: submissions });
            break;
    }
};

function processAssignments(assignments) {
    // Process assignments in the worker thread
    return assignments.map(assignment => ({
        ...assignment,
        dueDate: new Date(assignment.dueDate),
        isOverdue: new Date(assignment.dueDate) < new Date(),
        formattedDate: formatDate(assignment.dueDate)
    }));
}

function processSubmissions(submissions) {
    // Process submissions in the worker thread
    return submissions.map(submission => ({
        ...submission,
        submittedAt: new Date(submission.submittedAt),
        formattedDate: formatDate(submission.submittedAt)
    }));
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
