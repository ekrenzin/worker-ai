DROP TABLE IF EXISTS Messages;
-- Create the Comments table
CREATE TABLE IF NOT EXISTS Messages (
    MessageId INTEGER PRIMARY KEY,  -- Unique identifier for each comment
    IP TEXT,                 -- Identifier for the user who made the comment
    Prompt TEXT,               -- The actual comment
    Result TEXT,               -- The ID of the source that the comment is about
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Timestamp for when the comment was created
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP   -- Timestamp for when the comment was last updated
);
