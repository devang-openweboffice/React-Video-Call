import React from 'react';
import logo from './logo.png';
import {Toolbar, ToolbarRow, ToolbarSection, ToolbarTitle} from '@rmwc/toolbar';
import './Toolbar.css';

export default ({title}) => (
  <Toolbar>
    <ToolbarRow>
      <ToolbarSection alignStart>
        <img src={logo} alt="eyeson Logo" className="Toolbar-logo" />
      </ToolbarSection>
    </ToolbarRow>
  </Toolbar>
);
