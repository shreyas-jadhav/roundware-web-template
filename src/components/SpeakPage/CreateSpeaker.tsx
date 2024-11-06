import React from "react";
import { useRoundware } from "hooks";
import { circle } from '@turf/turf';
import moment from 'moment';
import finalConfig from "config";

const CreateSpeaker: React.FC = () => {
  const { roundware } = useRoundware();

  const createSpeaker = async () => {
  
    const center = [0, 0]; 
    const radius = 10; 

  
    const speakerShape = circle(center, radius, { units: 'meters' });

    const data = {
      activeyn: true,
      code: moment().format('DDMMYYHHmm'),
      maxvolume: 1.0,
      minvolume: 0.0, 
      shape: speakerShape, 
      uri: "http://roundware.org:8000/scapes2.mp3", // Audio file URI
      backupuri: "http://roundware.org:8000/scapes3.mp3", // Backup audio file URI
      attenuation_distance: 5, 
      project_id: finalConfig.project.id, 
    };

    try {
      // Using send to make a POST request
      const response = await roundware.apiClient.send('/speakers', data, { method: 'POST' });
      console.log(response); // Handle the response
    } catch (error) {
      console.error('Error creating speaker:', error);
    }
  };

  return (
    <div>
      <button onClick={createSpeaker}>Create Speaker</button>
    </div>
  );
};

export default CreateSpeaker;
